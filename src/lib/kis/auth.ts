// KIS API OAuth authentication — token acquisition and in-memory caching.
//
// Ported from investmentdiary's src/lib/kis/auth.ts (issue #5 research), dropped the
// Supabase-backed token store — this app has no equivalent table, and a 4-day
// prototype re-issuing a token per cold start is fine (KIS: 24h validity, 6h reissue
// interval, no documented rate limit on demo — see tr-ids.ts).
//
// Base URL defaults to the 모의투자 (paper trading) domain, not KIS's own 실전 default,
// so a missing KIS_BASE_URL env var fails safe instead of silently hitting production.

import "server-only";
import {
  KISApiError,
  KISError,
  KISRequestConfig,
  KISTokenRequest,
  KISTokenResponse,
} from "./types";

const DEMO_BASE_URL = "https://openapivts.koreainvestment.com:29443";

class KISAuthService {
  private baseUrl: string;
  private appKey: string;
  private appSecret: string;
  private token: KISTokenResponse | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.baseUrl = process.env.KIS_BASE_URL || DEMO_BASE_URL;
    this.appKey = process.env.KIS_APP_KEY || "";
    this.appSecret = process.env.KIS_APP_SECRET || "";

    if (!this.appKey || !this.appSecret) {
      throw new Error(
        "KIS API credentials not configured. Set KIS_APP_KEY and KIS_APP_SECRET."
      );
    }
  }

  async getAccessToken(config: KISRequestConfig = {}): Promise<string> {
    if (this.token && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.token.access_token;
    }
    await this.requestNewToken(config);
    if (!this.token) {
      throw new Error("Failed to obtain access token");
    }
    return this.token.access_token;
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

export const kisAuth = new KISAuthService();
