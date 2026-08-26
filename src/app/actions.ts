"use server";

import { commitThesis } from "@/lib/thesis/commit-thesis";
import { generateThesisResult, type GenerateThesisResultOutcome, type ThesisDraftInput } from "@/lib/thesis/generate-result";
import { getExistingThesis } from "@/lib/thesis/get-existing-thesis";
import type { CritiqueOutput } from "@/lib/llm/types";
import { getWatchlistView, type WatchlistViewItem } from "@/lib/watchlist/get-watchlist";
import { getWatchlistItemForOrder } from "@/lib/watchlist/get-watchlist-item";
import { recordOrderEvent, type OrderEventInput } from "@/lib/order/record-order-event";
import type { QuoteSnapshot, Thesis } from "@/lib/mock/types";

/** S1이 클라이언트에서 "3개월 후" 토글이 바뀔 때마다 호출하는 Server Action. */
export async function loadWatchlist(isFuture: boolean): Promise<WatchlistViewItem[]> {
  return getWatchlistView(isFuture);
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
