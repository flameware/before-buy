// KIS API OAuth authentication — token acquisition, cached in-memory (per warm
// instance) and in Postgres (across instances, issue #59).
//
// Ported from investmentdiary's src/lib/kis/auth.ts (issue #5 research). KIS limits
// token issuance to ~1/minute (EGW00133 — see docs/research/kis-financial-ratio.md),
// so on Vercel each cold start re-issuing independently could collide with that
// limit; tokenKey/kis-token.ts persist the token so instances share it instead.
//
// Parameterized rather than a singleton reading shared env vars: quote-client.ts and
// trade-client.ts each construct their own instance from domain-specific credentials
// (실전 조회 전용 vs 모의 거래), so there is no shared state a trade code path could
// read real credentials from (issue #13, spec 5-1). tokenKey keeps their persisted
// tokens in separate rows for the same reason.

import "server-only";
import { claimTokenRefresh, readValidToken, saveToken } from "../db/kis-token";
import {
  KISApiError,
  KISError,
  KISRequestConfig,
  KISTokenRequest,
  KISTokenResponse,
} from "./types";

const REFRESH_CLAIM_RETRY_DELAY_MS = 500;

export class KISAuthService {
  private baseUrl: string;
  private appKey: string;
  private appSecret: string;
  private tokenKey: string;
  private token: KISTokenResponse | null = null;
  private tokenExpiresAt: Date | null = null;
  private pendingTokenRequest: Promise<void> | null = null;

  constructor(options: {
    baseUrl: string;
    appKey: string;
    appSecret: string;
    tokenKey: string;
    label: string;
  }) {
    this.baseUrl = options.baseUrl;
    this.appKey = options.appKey;
    this.appSecret = options.appSecret;
    this.tokenKey = options.tokenKey;

    if (!this.appKey || !this.appSecret) {
      throw new Error(`KIS API credentials not configured for ${options.label}.`);
    }
  }

  async getAccessToken(config: KISRequestConfig = {}): Promise<string> {
    if (this.token && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.token.access_token;
    }

    // getKoreanStockPrices()가 티커별로 이 메서드를 동시에 호출한다 — 캐시가 비어
    // 있을 때 각 호출이 독립적으로 acquireToken을 트리거하면 한 번의 배치 조회로
    // 여러 번 불린다. 진행 중인 요청을 공유해 이 인스턴스 안에서는 한 번만 나가게 한다.
    if (!this.pendingTokenRequest) {
      this.pendingTokenRequest = this.acquireToken(config).finally(() => {
        this.pendingTokenRequest = null;
      });
    }
    await this.pendingTokenRequest;

    if (!this.token) {
      throw new Error("Failed to obtain access token");
    }
    return this.token.access_token;
  }

  // DB에 이미 유효한 토큰이 있으면 그걸 쓰고, 없으면 발급을 "claim"해서 이 인스턴스가
  // KIS에 실제로 요청하는 유일한 인스턴스가 되도록 한다(claim 실패 시 다른 인스턴스가
  // 방금 발급했을 수 있으니 한 번 더 읽어보고, 그래도 없으면 직접 요청한다).
  private async acquireToken(config: KISRequestConfig): Promise<void> {
    const stored = await readValidToken(this.tokenKey);
    if (stored) {
      this.token = { access_token: stored.accessToken, token_type: "Bearer", expires_in: 0 };
      this.tokenExpiresAt = stored.expiresAt;
      return;
    }

    const claimed = await claimTokenRefresh(this.tokenKey);
    if (!claimed) {
      await new Promise((resolve) => setTimeout(resolve, REFRESH_CLAIM_RETRY_DELAY_MS));
      const retried = await readValidToken(this.tokenKey);
      if (retried) {
        this.token = { access_token: retried.accessToken, token_type: "Bearer", expires_in: 0 };
        this.tokenExpiresAt = retried.expiresAt;
        return;
      }
    }

    await this.requestNewToken(config);
    if (this.token && this.tokenExpiresAt) {
      await saveToken(this.tokenKey, this.token.access_token, this.tokenExpiresAt);
    }
  }

  private async requestNewToken(config: KISRequestConfig = {}): Promise<void> {
    const tokenRequest: KISTokenRequest = {
      grant_type: "client_credentials",
      appkey: this.appKey,
      appsecret: this.appSecret,
    };

    let response: Response;
    try {
      response = await this.makeRequest("/oauth2/tokenP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenRequest),
        timeout: config.timeout || 10000,
      });
    } catch (error) {
      throw new KISApiError(
        {
          rt_cd: "NETWORK_ERROR",
          msg_cd: "NETWORK_ERROR",
          msg1: error instanceof Error ? error.message : "Network error during token request",
        },
        "/oauth2/tokenP"
      );
    }

    const responseText = await response.text();
    let tokenResponse: KISTokenResponse;
    try {
      tokenResponse = JSON.parse(responseText);
    } catch {
      throw new KISApiError(
        { rt_cd: "PARSE_ERROR", msg_cd: "PARSE_ERROR", msg1: "Invalid JSON response from token endpoint" },
        "/oauth2/tokenP"
      );
    }

    if (!tokenResponse.access_token) {
      const errorFields = tokenResponse as unknown as Partial<KISError>;
      throw new KISApiError(
        {
          rt_cd: errorFields.rt_cd ?? "TOKEN_ERROR",
          msg_cd: errorFields.msg_cd ?? "TOKEN_ERROR",
          msg1: errorFields.msg1 ?? "Failed to get access token from response",
        },
        "/oauth2/tokenP"
      );
    }

    this.token = tokenResponse;
    // Subtract 5 minutes for safety.
    this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000 - 5 * 60 * 1000);
  }

  async makeAuthenticatedRequest(
    endpoint: string,
    options: RequestInit = {},
    config: KISRequestConfig = {}
  ): Promise<Response> {
    const token = await this.getAccessToken(config);
    return this.makeRequest(endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        appkey: this.appKey,
        appsecret: this.appSecret,
        ...options.headers,
      },
    });
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const { timeout = 10000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
        );
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }
}
