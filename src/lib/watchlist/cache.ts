// S1 목록/시세의 클라이언트 캐시 규율 (ADR-0010).
//
// **바꾼 액션의 응답을 캐시에 옮겨 담는다.** ADR-0002는 담기·제외에서 목록을 invalidate
// 하도록 정했지만, 그 시점에 S1은 언마운트 상태라 활성 옵저버가 없어 무효화는 stale 표시만
// 하고 refetch를 시작하지 않는다. 실제 조회는 홈에 도착한 **뒤에야** 시작되고, 그동안 목록
// 캐시에는 옛 데이터가 남아 있어 `isLoading`이 `false`다 — S1이 틀린 목록을 먼저 그렸다가
// 왕복이 끝나면 갈아치웠다 (#107).
//
// 낙관적 UI가 아니다. 여기 들어오는 값은 **서버 액션이 성공으로 돌아오며 알려준 행**이고,
// 그래서 `CONTEXT.md`의 "목록 상태" 규율(결판나지 않은 것을 결판난 것처럼 말하지 않는다,
// #94)과 충돌하지 않는다. 결판난 사실을 두 번 묻지 않을 뿐이다.
//
// 이 파일이 훅이 아니라 따로 사는 이유는 `compose-view.ts`와 같다 — 훅은 Server Action을
// 임포트해 서버 전용 모듈을 끌고 오므로 단위 테스트에서 임포트할 수 없다 (#78).

import type { QueryClient } from "@tanstack/react-query";
import type { DemoScenario, QuoteSnapshot } from "@/lib/mock/types";
import type { SettledWatchlistItem, WatchlistListItem } from "@/lib/watchlist/get-watchlist";

export const WATCHLIST_LIST_KEY = ["watchlist", "list"] as const;

const QUOTES_KEY_ROOT = "watchlist";
const QUOTES_KEY_KIND = "quotes";

const SCENARIOS: DemoScenario[] = ["current", "future"];

/** 티커 하나당 결판난 시세 하나. `null`은 조회 실패다 — 서버에는 "조회 중"이 없다. */
export type QuoteMap = Record<string, QuoteSnapshot | null>;

export function quotesKey(scenario: DemoScenario, tickerKey: string) {
  return [QUOTES_KEY_ROOT, QUOTES_KEY_KIND, scenario, tickerKey] as const;
}

/**
 * 시세 쿼리 키의 대상 부분. 종목 구성이 바뀌면 키가 바뀌어야 한다 — 키가 조회 대상을
 * 말하지 않으면 캐시가 거짓말을 한다.
 */
export function toTickerKey(items: { ticker: string }[]): string {
  return items
    .map((i) => i.ticker)
    .sort()
    .join(",");
}

/** 담긴 종목을 목록 끝에 붙인다. 서버 목록이 `createdAt` 오름차순이라 새 종목은 마지막이다. */
export function appendItem(
  prev: WatchlistListItem[],
  item: WatchlistListItem
): WatchlistListItem[] {
  if (prev.some((i) => i.ticker === item.ticker)) {
    return prev.map((i) => (i.ticker === item.ticker ? item : i));
  }
  return [...prev, item];
}

/** 제외된 종목을 목록에서 뺀다. */
export function dropItem(prev: WatchlistListItem[], ticker: string): WatchlistListItem[] {
  return prev.filter((i) => i.ticker !== ticker);
}

/** 이전 시세 맵에서 여전히 필요한 티커만 남긴다. 없는 티커는 지어내지 않는다. */
export function retainQuotes(prev: QuoteMap, tickers: string[]): QuoteMap {
  const next: QuoteMap = {};
  for (const ticker of tickers) {
    if (ticker in prev) next[ticker] = prev[ticker];
  }
  return next;
}

/**
 * 티커 전부를 담고 있는가. **부분 맵은 캐시에 심지 않는다** — 빠진 티커는 시세가 아직 오지
 * 않은 것인데, 맵에 자리가 없으면 화면이 그것을 "조회 실패"로 읽을 여지가 생긴다.
 * `quoteStateFor`가 그 구분을 지키지만, 애초에 반쪽짜리 사실을 캐시에 넣지 않는 쪽이 싸다.
 */
export function coversAll(map: QuoteMap, tickers: string[]): boolean {
  return tickers.every((t) => t in map);
}

/** 캐시에 남아 있는 그 시점의 시세 중 가장 최근 것. 나이를 함께 돌려준다. */
function freshestQuotes(
  queryClient: QueryClient,
  scenario: DemoScenario
): { data: QuoteMap; updatedAt: number } | undefined {
  let best: { data: QuoteMap; updatedAt: number } | undefined;
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: [QUOTES_KEY_ROOT, QUOTES_KEY_KIND, scenario] })) {
    const data = query.state.data as QuoteMap | undefined;
    if (!data) continue;
    if (!best || query.state.dataUpdatedAt > best.updatedAt) {
      best = { data, updatedAt: query.state.dataUpdatedAt };
    }
  }
  return best;
}

/**
 * 종목 구성이 바뀌면 시세 쿼리 키가 통째로 갈아치워진다 — 새 키에는 데이터가 없으므로
 * 담기/제외 직후 **목록 전체**의 가격과 배지가 스켈레톤으로 무너졌다가 함께 돌아왔다.
 * 건드리지도 않은 종목까지 깜빡였다 (#107).
 *
 * 그래서 이전 키에서 살아남은 티커의 시세를 새 키로 옮겨 담는다. **나이도 함께 옮긴다**
 * (`updatedAt`) — 이월 시점을 갱신 시점으로 쓰면 20초 `staleTime`이 거기서 다시 시작해,
 * 이월된 가격이 방금 받은 값처럼 최대 20초 동안 굳는다.
 *
 * `planted`는 이월할 것이 없는 티커(방금 담은 종목)를 시점별로 채워 넣는 자리다.
 */
function carryQuoteCaches(
  queryClient: QueryClient,
  items: { ticker: string }[],
  planted: Partial<Record<DemoScenario, QuoteMap>> = {}
): void {
  const tickers = items.map((i) => i.ticker);
  const key = toTickerKey(items);

  for (const scenario of SCENARIOS) {
    const carried = freshestQuotes(queryClient, scenario);
    if (!carried) continue;
    const merged = { ...retainQuotes(carried.data, tickers), ...(planted[scenario] ?? {}) };
    if (!coversAll(merged, tickers)) continue;
    // 심은 값이 이월된 값보다 새롭더라도 맵 전체의 나이는 가장 오래된 쪽에 맞춘다.
    // 재검증이 예정보다 일찍 오는 것은 안전하고, 늦게 오는 것은 아니다.
    queryClient.setQueryData(quotesKey(scenario, key), merged, { updatedAt: carried.updatedAt });
  }
}

/**
 * 담기 성공 직후: 서버가 돌려준 행을 목록 캐시에 붙이고, 담을 때 이미 조회된 시세를
 * 시세 캐시에도 심는다.
 *
 * **시세를 두 시점 캐시 모두에 심는 것은 이 종목이 시드가 아니기 때문이다.** `resolveQuotes`는
 * `!isSeed || !isFuture`인 티커를 실시간 조회 대상으로 삼으므로, 비시드 종목은 `3개월 후`에도
 * 같은 실시간 시세를 쓴다(화면명세: "사용자가 담은 종목은 미래 시점에도 실시간 시세").
 * 시드였다면 미래 키는 fixture 시세라 이 값을 심으면 안 되고, 그러면 가격뿐 아니라 배지까지
 * 틀린다(ADR-0004) — 그 사실이 조건으로 남아 있어야 나중에 시드가 늘어도 조용히 깨지지 않는다.
 */
export function applyWatchlistAdded(queryClient: QueryClient, added: SettledWatchlistItem): void {
  const { quote, ...item } = added;
  const prev = queryClient.getQueryData<WatchlistListItem[]>(WATCHLIST_LIST_KEY);
  // S1을 아직 한 번도 열지 않았으면 옮겨 담을 목록이 없다. 1건짜리 목록을 지어내면 시드까지
  // 사라진 목록을 "확인 완료"로 주장하게 되므로, 조용히 물러나 평소의 조회에 맡긴다.
  if (!prev) return;

  const next = appendItem(prev, item);
  queryClient.setQueryData(WATCHLIST_LIST_KEY, next);

  const planted: QuoteMap = { [item.ticker]: quote };
  carryQuoteCaches(queryClient, next, {
    current: planted,
    future: item.isSeed ? undefined : planted,
  });
}

/** 제외 성공 직후: 목록에서 빼고, 남은 종목의 시세를 새 키로 이월한다. */
export function applyWatchlistRemoved(queryClient: QueryClient, ticker: string): void {
  const prev = queryClient.getQueryData<WatchlistListItem[]>(WATCHLIST_LIST_KEY);
  if (!prev) return;

  const next = dropItem(prev, ticker);
  if (next.length === prev.length) return;
  queryClient.setQueryData(WATCHLIST_LIST_KEY, next);

  carryQuoteCaches(queryClient, next);
}
