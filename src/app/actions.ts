"use server";

import { commitThesis } from "@/lib/thesis/commit-thesis";
import { generateThesisResult, type GenerateThesisResultOutcome, type ThesisDraftInput } from "@/lib/thesis/generate-result";
import { getExistingThesis } from "@/lib/thesis/get-existing-thesis";
import type { CritiqueOutput } from "@/lib/llm/types";
import { getWatchlistListView, getWatchlistQuoteMap, type SettledWatchlistItem, type WatchlistListItem } from "@/lib/watchlist/get-watchlist";
import { getWatchlistItemDetail, getWatchlistItemForOrder, removeWatchlistItem } from "@/lib/watchlist/get-watchlist-item";
import { addWatchlistItemWithoutThesis } from "@/lib/watchlist/add-without-thesis";
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

/**
 * S1 시세 쿼리(React Query)가 목록 로드 후 호출하는 Server Action.
 *
 * **던지지 않는다** (#82). 액션이 throw하면 클라이언트 promise는 정상적으로 reject되지만
 * (#83에서 확인 — Flight 계층은 멀쩡하다), 그 리젝션은 React Query의 재시도 대상이 되고
 * 재시도는 배경 탭에서 무한정 멈춘다(ADR-0011). 잡을 수 있는 실패는 여기서 잡아 종목별
 * `null`로 접는다 — 그 자리는 이미 "조회 실패"를 뜻하므로 반환 타입도, 화면도 그대로고,
 * 애초에 리젝션을 만들지 않으니 재시도에 걸릴 일도 없다.
 *
 * 이것만으로는 부족하다. 직렬화 실패(`return` 이후)와 인프라 크래시는 이 `try` 밖이라
 * 응답이 아예 오지 않을 수 있고, 그쪽은 호출부의 타임아웃이 맡는다
 * (`use-watchlist-view.ts`의 `QUOTES_TIMEOUT_MS`). 두 겹이 함께 걸려야 원인과
 * 무관하게 쿼리가 정착한다.
 */
export async function loadWatchlistQuotes(
  items: { ticker: string; isSeed: boolean }[],
  scenario: DemoScenario
): Promise<Record<string, QuoteSnapshot | null>> {
  try {
    return await getWatchlistQuoteMap(items, scenario);
  } catch (error) {
    console.error("[loadWatchlistQuotes] 시세 조회 실패", error);
    return Object.fromEntries(items.map((item) => [item.ticker, null]));
  }
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

/**
 * S3 "이대로 담기": 이미 생성된 critique/quote를 재사용해 원자적으로 커밋하고,
 * **담긴 행을 그대로 돌려준다** — 호출부가 S1 캐시에 옮겨 담는다 (#107, ADR-0010).
 */
export async function commitThesisAction(
  ticker: string,
  draft: ThesisDraftInput,
  critique: CritiqueOutput,
  quote: QuoteSnapshot
): Promise<SettledWatchlistItem> {
  return commitThesis(ticker, draft, critique, quote);
}

/**
 * S2 Step 1 "건너뛰기": 근거 없이 종목만 담는다 (#96).
 *
 * S3를 거치지 않으므로 LLM 호출도 critique도 없다. 담은 날 가격을 위한 KIS 왕복
 * 한 번이 전부이고, 그마저 실패해도 담기는 성공한다.
 *
 * 담긴 행을 그대로 돌려준다 — 호출부가 S1 캐시에 옮겨 담는다 (#107, ADR-0010).
 */
export async function addWithoutThesisAction(ticker: string): Promise<SettledWatchlistItem> {
  return addWatchlistItemWithoutThesis(ticker);
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

/**
 * S5 "관심종목에서 제외": watchlist_items.status를 'removed'로 실제 update하고 뺀 티커를
 * 돌려준다. 0-row였다면 `null` — 호출부는 그때 캐시를 건드리지 않는다 (#107, ADR-0010).
 */
export async function removeWatchlistItemAction(ticker: string): Promise<string | null> {
  return removeWatchlistItem(ticker);
}

/**
 * S1.5 종목 검색 — 상장 종목 전체를 대상으로 한다 (#92, ADR-0008).
 *
 * 마스터를 읽지 못하면 `getListedStocks`가 빈 배열을 돌려주므로 결과도 비어 있다.
 * 던지지 않는 게 중요하다 — 액션이 throw하면 클라이언트 promise가 reject되고, 그
 * 리젝션은 React Query의 재시도 대상이 되어 배경 탭에서 무한정 멈춘다(ADR-0011, #83).
 * 시세 쿼리는 `retry: false`와 타임아웃으로 그 자리를 막았지만(#82), 이 검색 쿼리에는
 * 그 그물이 없다.
 */
export async function searchStocksAction(query: string): Promise<Stock[]> {
  const stocks = await getListedStocks();
  return searchStockMaster(stocks, query, SEARCH_RESULT_LIMIT);
}
