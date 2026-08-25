// KIS API client — 국내주식 현재가 (domestic stock current price) only.
// Ported from investmentdiary's src/lib/kis/client.ts (issue #5 research).

import "server-only";
import { kisAuth } from "./auth";
import { describeIssues, KoreanPriceOutputSchema } from "./schemas";
import { KISApiError, KISRequestConfig, KISResponse, ProcessedStockPrice } from "./types";
import { KIS_TR_ID_DEMO } from "./tr-ids";

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
    response = await kisAuth.makeAuthenticatedRequest(
      endpoint,
      {
        method: "GET",
        headers: {
          tr_id: KIS_TR_ID_DEMO.inquirePrice,
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

  const responseText = await response.text();
  let data: KISResponse<unknown>;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new KISApiError(
      { rt_cd: "PARSE_ERROR", msg_cd: "PARSE_ERROR", msg1: "Invalid JSON response from Korean stock API" },
      endpoint
    );
  }

  if (data.rt_cd !== "0") {
    throw new KISApiError(
      { rt_cd: data.rt_cd, msg_cd: data.msg_cd, msg1: data.msg1 },
      "/uapi/domestic-stock/v1/quotations/inquire-price"
    );
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
      "/uapi/domestic-stock/v1/quotations/inquire-price"
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
    metadata: {
      originalData: priceData,
      lastUpdated: new Date().toISOString(),
    },
  };
}
