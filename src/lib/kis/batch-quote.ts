// 여러 종목의 현재가(PER/PBR 포함)를 병렬로 조회하는 배치 계층. 캐싱은 하지 않는다
// (범위 밖 — 지도 #38 Notes 참고) — 호출마다 quote-client.ts를 직접 두드린다.
//
// 개별 종목 실패(존재하지 않는 티커, KIS 오류 등)가 나머지 종목 조회를 막지 않도록
// Promise.allSettled로 격리하고, 종목별 성공/실패를 티커로 바로 조회 가능한 Map으로
// 반환한다. 워치리스트 규모(시드 A/B/C 기준 수 종목)에서는 동시성 제한이 필요 없다.

import "server-only";
import { getKoreanStockPrice } from "./quote-client";
import { KISApiError, KISRequestConfig, ProcessedStockPrice } from "./types";

export type QuoteResult =
  | { ok: true; data: ProcessedStockPrice }
  | { ok: false; error: string };

export type BatchQuoteResult = Map<string, QuoteResult>;

function describeQuoteError(error: unknown): string {
  if (error instanceof KISApiError) return error.error.msg1;
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류로 시세를 조회하지 못했습니다";
}

/**
 * 중복 제거된 티커마다 {@link getKoreanStockPrice}를 병렬 호출해 결과를 Map으로 반환한다.
 * 존재하지 않는 종목(null 응답)과 조회 실패(예외)를 모두 `{ ok: false }` 항목으로 통일해,
 * 호출부가 예외 처리 없이 종목별 성공/실패만 확인하면 되도록 한다.
 */
export async function getKoreanStockPrices(
  tickers: string[],
  config: KISRequestConfig = {}
): Promise<BatchQuoteResult> {
  const uniqueTickers = [...new Set(tickers)];

  const settled = await Promise.allSettled(
    uniqueTickers.map((ticker) => getKoreanStockPrice(ticker, config))
  );

  const result: BatchQuoteResult = new Map();
  settled.forEach((outcome, index) => {
    const ticker = uniqueTickers[index];
    if (outcome.status === "rejected") {
      result.set(ticker, { ok: false, error: describeQuoteError(outcome.reason) });
      return;
    }
    if (outcome.value === null) {
      result.set(ticker, { ok: false, error: "존재하지 않는 종목입니다" });
      return;
    }
    result.set(ticker, { ok: true, data: outcome.value });
  });

  return result;
}
