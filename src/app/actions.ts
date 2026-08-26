"use server";

import { commitThesis } from "@/lib/thesis/commit-thesis";
import { generateThesisResult, type GenerateThesisResultOutcome, type ThesisDraftInput } from "@/lib/thesis/generate-result";
import { getExistingThesis } from "@/lib/thesis/get-existing-thesis";
import type { CritiqueOutput } from "@/lib/llm/types";
import { getWatchlistListView, getWatchlistQuoteMap, type WatchlistListItem, type WatchlistViewItem } from "@/lib/watchlist/get-watchlist";
import { getWatchlistItemDetail, getWatchlistItemForOrder, removeWatchlistItem } from "@/lib/watchlist/get-watchlist-item";
import { recordOrderEvent, type OrderEventInput } from "@/lib/order/record-order-event";
import type { QuoteSnapshot, Thesis } from "@/lib/mock/types";

/** S1 목록 쿼리(React Query)가 호출하는 Server Action. 시세는 포함하지 않는다 (ADR-0002). */
export async function loadWatchlistList(isFuture: boolean): Promise<WatchlistListItem[]> {
  return getWatchlistListView(isFuture);
}

/** S1 시세 쿼리(React Query)가 목록 로드 후 호출하는 Server Action. */
export async function loadWatchlistQuotes(
  items: { ticker: string; isSeed: boolean }[],
  isFuture: boolean
): Promise<Record<string, QuoteSnapshot | null>> {
  return getWatchlistQuoteMap(items, isFuture);
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

/** S4 진입: 세션 소유 관심종목을 ticker로 조회한다. 판정은 돌리지 않고 읽기만 한다. */
export async function getOrderConfirmItemAction(
  ticker: string,
  isFuture: boolean
): Promise<WatchlistViewItem | null> {
  return getWatchlistItemForOrder(ticker, isFuture);
}

/** S4 취소/구매/시트닫기/근거갱신 4개 분기 모두에서 호출: order_events 1건을 남긴다. */
export async function recordOrderEventAction(input: OrderEventInput): Promise<void> {
  return recordOrderEvent(input);
}

/** S5 진입: 해당 종목만 단건 재판정한 뒤 최신 상태를 조회한다. */
export async function getWatchlistItemDetailAction(
  ticker: string,
  isFuture: boolean
): Promise<WatchlistViewItem | null> {
  return getWatchlistItemDetail(ticker, isFuture);
}

/** S5 "관심종목에서 제외": watchlist_items.status를 'removed'로 실제 update한다. */
export async function removeWatchlistItemAction(ticker: string): Promise<void> {
  return removeWatchlistItem(ticker);
}
