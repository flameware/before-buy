"use server";

import { commitThesis } from "@/lib/thesis/commit-thesis";
import { generateThesisResult, type GenerateThesisResultOutcome, type ThesisDraftInput } from "@/lib/thesis/generate-result";
import { getExistingThesis } from "@/lib/thesis/get-existing-thesis";
import type { CritiqueOutput } from "@/lib/llm/types";
import { getWatchlistListView, getWatchlistQuoteMap, type SettledWatchlistItem, type WatchlistListItem } from "@/lib/watchlist/get-watchlist";
import { getWatchlistItemDetail, getWatchlistItemForOrder, removeWatchlistItem } from "@/lib/watchlist/get-watchlist-item";
import { recordOrderEvent, recordOrderEventByTicker, type OrderEventInput } from "@/lib/order/record-order-event";
import { getListedStocks } from "@/lib/kis/stock-master";
import { SEARCH_RESULT_LIMIT, searchStockMaster } from "@/lib/kis/stock-master-parse";
import type { Stock } from "@/lib/mock/types";
import type { DemoScenario, QuoteSnapshot, Thesis } from "@/lib/mock/types";

/**
 * S1 목록 쿼리(React Query)가 호출하는 Server Action. 시세도 데모 시점도 받지
 * 않는다 — 시점에 의존하는 것은 시세뿐이다 (ADR-0002, ADR-0004).
 */
export async function loadWatchlistList(): Promise<WatchlistListItem[]> {
  return getWatchlistListView();
}

/** S1 시세 쿼리(React Query)가 목록 로드 후 호출하는 Server Action. */
export async function loadWatchlistQuotes(
  items: { ticker: string; isSeed: boolean }[],
  scenario: DemoScenario
): Promise<Record<string, QuoteSnapshot | null>> {
  return getWatchlistQuoteMap(items, scenario);
}

/** S3 진입 시 1회: S2 draft에 실 시세를 붙여 LLM(critique+전제)을 생성한다. */
export async function generateThesisResultAction(
  ticker: string,
  draft: ThesisDraftInput
): Promise<GenerateThesisResultOutcome> {
  return generateThesisResult(ticker, draft);
}

/** S3 fallback: draft 없이 진입한 시드 종목의 기존 thesis를 DB에서 그대로 읽는다. */
export async function getExistingThesisAction(ticker: string): Promise<Thesis | null> {
  return getExistingThesis(ticker);
}

/** S3 "이대로 담기": 이미 생성된 critique/quote를 재사용해 원자적으로 커밋한다. */
export async function commitThesisAction(
  ticker: string,
  draft: ThesisDraftInput,
  critique: CritiqueOutput,
  quote: QuoteSnapshot
): Promise<void> {
  return commitThesis(ticker, draft, critique, quote);
}

/** S4 진입: 세션 소유 관심종목을 ticker로 조회한다. 전제 상태는 이 시점 시세로 계산된다. */
export async function getOrderConfirmItemAction(
  ticker: string,
  scenario: DemoScenario
): Promise<SettledWatchlistItem | null> {
  return getWatchlistItemForOrder(ticker, scenario);
}

/** S4 취소/구매/시트닫기/근거갱신 4개 분기 모두에서 호출: order_events 1건을 남긴다. */
export async function recordOrderEventAction(input: OrderEventInput): Promise<void> {
  return recordOrderEvent(input);
}

/** S4: 근거가 뜨기 전에 닫은 경우 — watchlist_item_id를 서버에서 티커로 찾아 남긴다. */
export async function recordOrderEventByTickerAction(
  input: Omit<OrderEventInput, "watchlistItemId"> & { ticker: string }
): Promise<void> {
  return recordOrderEventByTicker(input);
}

/** S5 진입: 해당 종목 1건을 조회한다. 전제 상태는 이 시점 시세로 계산된다. */
export async function getWatchlistItemDetailAction(
  ticker: string,
  scenario: DemoScenario
): Promise<SettledWatchlistItem | null> {
  return getWatchlistItemDetail(ticker, scenario);
}

/** S5 "관심종목에서 제외": watchlist_items.status를 'removed'로 실제 update한다. */
export async function removeWatchlistItemAction(ticker: string): Promise<void> {
  return removeWatchlistItem(ticker);
}

/**
 * S1.5 종목 검색 — 상장 종목 전체를 대상으로 한다 (#92, ADR-0008).
 *
 * 마스터를 읽지 못하면 `getListedStocks`가 빈 배열을 돌려주므로 결과도 비어 있다.
 * 던지지 않는 게 중요하다 — Server Action이 throw하면 클라이언트 promise가 reject되지
 * 않고 쿼리가 영원히 pending에 머문다(#82·#83, 미해결).
 */
export async function searchStocksAction(query: string): Promise<Stock[]> {
  const stocks = await getListedStocks();
  return searchStockMaster(stocks, query, SEARCH_RESULT_LIMIT);
}
