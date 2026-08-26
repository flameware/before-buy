// 여러 종목의 현재가(PER/PBR 포함)를 병렬로 조회하는 배치 계층. 티커별로 60초
// TTL 인메모리 캐시를 둔다 — S1 로드마다 전제 판정 엔진과 화면 표시가 각각 같은
// 티커를 부르는 데다, 실사용 체감상 매 요청 KIS 호출이 너무 느려 캐싱을 도입했다
// (지도 #38 "캐싱 안 함" 결정을 뒤집음). 캐시는 모듈 스코프 Map이라 서버리스
// 인스턴스 하나가 warm한 동안만 유효하고, 콜드 스타트/인스턴스 교체 시 초기화된다
// — 프로토타입 규모에서는 그 정도로 충분하다고 판단.
//
// 개별 종목 실패(존재하지 않는 티커, KIS 오류 등)가 나머지 종목 조회를 막지 않도록
// Promise.allSettled로 격리하고, 종목별 성공/실패를 티커로 바로 조회 가능한 Map으로
// 반환한다. 워치리스트 규모(시드 A/B/C/D/E 기준 수 종목)에서는 동시성 제한이 필요 없다.

import "server-only";
import { getKoreanStockPrice } from "./quote-client";
import { KISApiError, KISRequestConfig, ProcessedStockPrice } from "./types";

export type QuoteResult =
  | { ok: true; data: ProcessedStockPrice }
  | { ok: false; error: string };

export type BatchQuoteResult = Map<string, QuoteResult>;

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  result: QuoteResult;
  expiresAt: number;
}

const quoteCache = new Map<string, CacheEntry>();

function describeQuoteError(error: unknown): string {
  if (error instanceof KISApiError) return error.error.msg1;
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류로 시세를 조회하지 못했습니다";
}

/**
 * 중복 제거된 티커마다, 캐시에 없거나 만료된 것만 {@link getKoreanStockPrice}를
 * 병렬 호출해 결과를 Map으로 반환한다. 존재하지 않는 종목(null 응답)과 조회
 * 실패(예외)를 모두 `{ ok: false }` 항목으로 통일해(실패도 TTL만큼 캐시된다),
 * 호출부가 예외 처리 없이 종목별 성공/실패만 확인하면 되도록 한다.
 */
export async function getKoreanStockPrices(
  tickers: string[],
  config: KISRequestConfig = {}
): Promise<BatchQuoteResult> {
  const uniqueTickers = [...new Set(tickers)];
  const now = Date.now();

  const result: BatchQuoteResult = new Map();
  const toFetch: string[] = [];
  for (const ticker of uniqueTickers) {
    const cached = quoteCache.get(ticker);
    if (cached && cached.expiresAt > now) {
      result.set(ticker, cached.result);
    } else {
      toFetch.push(ticker);
    }
  }

  if (toFetch.length > 0) {
    const settled = await Promise.allSettled(
      toFetch.map((ticker) => getKoreanStockPrice(ticker, config))
    );

    settled.forEach((outcome, index) => {
      const ticker = toFetch[index];
      const quoteResult: QuoteResult =
        outcome.status === "rejected"
          ? { ok: false, error: describeQuoteError(outcome.reason) }
          : outcome.value === null
            ? { ok: false, error: "존재하지 않는 종목입니다" }
            : { ok: true, data: outcome.value };

      quoteCache.set(ticker, { result: quoteResult, expiresAt: now + CACHE_TTL_MS });
      result.set(ticker, quoteResult);
    });
  }

  return result;
}
