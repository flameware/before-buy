// KIS quote client — 실전 도메인, 조회 전용(read-only). 현재가 시세 + 재무비율(PER/PBR).
//
// 모의투자 도메인은 재무비율을 제공하지 않으므로(issue #9), 조회는 항상 실전 도메인으로
// 보낸다. 이 파일은 KIS_REAL_APPKEY_READONLY/KIS_REAL_APPSECRET_READONLY만 참조하고
// 주문/잔고(쓰기) 메서드는 두지 않는다 — 실계좌 사고를 구조적으로 막기 위해 거래
// 경로는 trade-client.ts로 완전히 분리되어 있다(spec 5-1, issue #13).

import "server-only";
import { KISAuthService } from "./auth";
import { describeIssues, FinancialRatioOutputSchema, KoreanPriceOutputSchema } from "./schemas";
import {
  FinancialRatio,
  KISApiError,
  KISRequestConfig,
  KISResponse,
  ProcessedStockPrice,
} from "./types";
import { KIS_TR_ID_REAL } from "./tr-ids";

const KIS_REAL_BASE_URL = "https://openapi.koreainvestment.com:9443";

const quoteAuth = new KISAuthService({
  baseUrl: KIS_REAL_BASE_URL,
  appKey: process.env.KIS_REAL_APPKEY_READONLY || "",
  appSecret: process.env.KIS_REAL_APPSECRET_READONLY || "",
  tokenKey: "quote",
  label: "quote-client (실전 조회 전용)",
});

async function parseKisResponse(response: Response, endpoint: string): Promise<KISResponse<unknown>> {
  const responseText = await response.text();
  try {
    return JSON.parse(responseText);
  } catch {
    throw new KISApiError(
      { rt_cd: "PARSE_ERROR", msg_cd: "PARSE_ERROR", msg1: "Invalid JSON response from KIS API" },
      endpoint
    );
  }
}

export async function getKoreanStockPrice(
  ticker: string,
  config: KISRequestConfig = {}
): Promise<ProcessedStockPrice | null> {
  const formattedTicker = ticker.padStart(6, "0");
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: formattedTicker,
  });
  const endpoint = `/uapi/domestic-stock/v1/quotations/inquire-price?${params}`;

  let response: Response;
  try {
    response = await quoteAuth.makeAuthenticatedRequest(
      endpoint,
      {
        method: "GET",
        headers: {
          tr_id: KIS_TR_ID_REAL.inquirePrice,
          custtype: "P",
        },
      },
      config
    );
  } catch (error) {
    throw new KISApiError({
      rt_cd: "FETCH_ERROR",
      msg_cd: "FETCH_ERROR",
      msg1: error instanceof Error ? error.message : "Unknown error fetching Korean stock price",
    });
  }

  const data = await parseKisResponse(response, endpoint);
  if (data.rt_cd !== "0") {
    throw new KISApiError({ rt_cd: data.rt_cd, msg_cd: data.msg_cd, msg1: data.msg1 }, endpoint);
  }

  const priceData = data.output;
  if (!priceData) return null;

  const parsed = KoreanPriceOutputSchema.safeParse(priceData);
  if (!parsed.success) {
    throw new KISApiError(
      {
        rt_cd: "SCHEMA_ERROR",
        msg_cd: "SCHEMA_ERROR",
        msg1: `국내 현재가 응답을 해석할 수 없습니다 — ${describeIssues(parsed.error)}`,
      },
      endpoint
    );
  }
  const output = parsed.data;

  return {
    ticker,
    date: new Date().toISOString().slice(0, 10),
    price: output.stck_prpr,
    open: output.stck_oprc,
    high: output.stck_hgpr,
    low: output.stck_lwpr,
    volume: output.acml_vol,
    change: output.prdy_vrss,
    changePercent: output.prdy_ctrt,
    per: output.per,
    pbr: output.pbr,
    metadata: {
      originalData: priceData,
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * 국내주식 재무비율 (FHKST66430300) — 실전 도메인 전용, 모의투자에서는 데이터가
 * 제공되지 않는다(issue #9). `fidDivClsCode`는 "0"(년) 또는 "1"(분기), 기본값 "0".
 */
export async function getFinancialRatio(
  ticker: string,
  options: { fidDivClsCode?: "0" | "1" } & KISRequestConfig = {}
): Promise<FinancialRatio | null> {
  const { fidDivClsCode = "0", ...config } = options;
  const formattedTicker = ticker.padStart(6, "0");
  const params = new URLSearchParams({
    FID_DIV_CLS_CODE: fidDivClsCode,
    fid_cond_mrkt_div_code: "J",
    fid_input_iscd: formattedTicker,
  });
  const endpoint = `/uapi/domestic-stock/v1/finance/financial-ratio?${params}`;

  let response: Response;
  try {
    response = await quoteAuth.makeAuthenticatedRequest(
      endpoint,
      {
        method: "GET",
        headers: {
          tr_id: KIS_TR_ID_REAL.financialRatio,
          custtype: "P",
        },
      },
      config
    );
  } catch (error) {
    throw new KISApiError({
      rt_cd: "FETCH_ERROR",
      msg_cd: "FETCH_ERROR",
      msg1: error instanceof Error ? error.message : "Unknown error fetching financial ratio",
    });
  }

  const data = await parseKisResponse(response, endpoint);
  if (data.rt_cd !== "0") {
    throw new KISApiError({ rt_cd: data.rt_cd, msg_cd: data.msg_cd, msg1: data.msg1 }, endpoint);
  }

  // KIS returns `output` as an array for this endpoint (multiple periods) — see
  // docs/research/kis-adapter-port.md §2.3. The most recent period is first.
  const rawOutput = data.output;
  const rows = Array.isArray(rawOutput) ? rawOutput : rawOutput ? [rawOutput] : [];
  const latest = rows[0];
  if (!latest) return null;

  const parsed = FinancialRatioOutputSchema.safeParse(latest);
  if (!parsed.success) {
    throw new KISApiError(
      {
        rt_cd: "SCHEMA_ERROR",
        msg_cd: "SCHEMA_ERROR",
        msg1: `재무비율 응답을 해석할 수 없습니다 — ${describeIssues(parsed.error)}`,
      },
      endpoint
    );
  }

  return {
    ticker,
    metadata: {
      originalData: latest,
      lastUpdated: new Date().toISOString(),
    },
  };
}
