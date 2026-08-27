"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWatchlistItemDetailAction,
  loadWatchlistList,
  loadWatchlistQuotes,
} from "@/app/actions";
import type { DemoScenario } from "@/lib/mock/types";
import { QUOTE_FAILED, QUOTE_LOADING, settledQuote, type QuoteState } from "@/lib/quote/quote-state";
import {
  quotesKey,
  toTickerKey,
  WATCHLIST_LIST_KEY as LIST_KEY,
  type QuoteMap,
} from "@/lib/watchlist/cache";
import { composeView } from "@/lib/watchlist/compose-view";
import type { SettledWatchlistItem, WatchlistListItem } from "@/lib/watchlist/get-watchlist";

/** ADR-0002: 목록은 60초, 시세는 20초 — 재방문 시 캐시가 신선하면 즉시 렌더하고 조용히 갱신한다. */
const LIST_STALE_TIME_MS = 60_000;
const QUOTES_STALE_TIME_MS = 20_000;

/**
 * 시세 쿼리의 상태를 종목 하나의 시세 상태로 옮긴다. 실패는 두 경로로 온다 — 쿼리 전체
 * reject와 응답 안에서 그 티커만 `null`인 경우(KIS 개별 조회 실패) — 둘 다 `failed`로
 * 접는다. 사용자가 취할 행동이 같기 때문이다.
 *
 * `isFetching`이 아니라 "이 티커의 결과가 아직 없음"만 `loading`으로 본다. 캐시된 값이 있는
 * 재검증 중에는 이전 값을 그대로 보여준다 — 캐시를 나눈 목적이 그것이다(ADR-0002).
 *
 * 맵에 **자리가 없는 것**과 자리가 `null`인 것을 가른다. 담기/제외 직후에는 이전 키에서
 * 이월된 시세가 먼저 들어와 있을 수 있고(`cache.ts`), 그 맵에 아직 없는 티커는 조회에
 * 실패한 것이 아니라 결과가 아직 오지 않은 것이다. 조회가 끝났는데도(`!isFetching`)
 * 자리가 없다면 그때는 실패다 — 결판난 뒤에도 기다리는 척하지 않는다.
 */
function quoteStateFor(
  ticker: string,
  data: QuoteMap | undefined,
  isError: boolean,
  isFetching: boolean
): QuoteState {
  if (data && ticker in data) return settledQuote(data[ticker]);
  if (isError) return QUOTE_FAILED;
  return data && !isFetching ? QUOTE_FAILED : QUOTE_LOADING;
}

/**
 * S1 관심종목 목록. 목록 쿼리와 시세 쿼리를 분리해 서로 다른 신선도로 캐싱하고
 * (ADR-0002), 데모 시점은 시세 쿼리 키에만 들어간다 (ADR-0004).
 *
 * `scenario`를 인자로 받는 이유: `useDemoScenario`는 `useState` 기반이라 여기서 다시
 * 호출하면 호출부와 별개의 상태가 생겨 토글이 어긋난다.
 */
export function useWatchlistView(scenario: DemoScenario, hydrated: boolean) {
  const listQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => loadWatchlistList(),
    enabled: hydrated,
    staleTime: LIST_STALE_TIME_MS,
  });

  const listItems = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const quoteTargets = useMemo(
    () => listItems.map((item) => ({ ticker: item.ticker, isSeed: item.isSeed })),
    [listItems]
  );
  const tickerKey = toTickerKey(quoteTargets);

  const quotesQuery = useQuery({
    queryKey: quotesKey(scenario, tickerKey),
    queryFn: () => loadWatchlistQuotes(quoteTargets, scenario),
    enabled: hydrated && quoteTargets.length > 0,
    staleTime: QUOTES_STALE_TIME_MS,
  });

  const quotesData = quotesQuery.data;
  const quotesError = quotesQuery.isError;
  const quotesFetching = quotesQuery.isFetching;
  const items = useMemo(
    () =>
      listItems.map((item) =>
        composeView(item, quoteStateFor(item.ticker, quotesData, quotesError, quotesFetching))
      ),
    [listItems, quotesData, quotesError, quotesFetching]
  );

  // 하이드레이션 전에는 `enabled: false`라 `isLoading`이 `false`다(v5의 `isLoading`은
  // `isPending && isFetching`). 그대로 넘기면 호출부는 "목록이 비었다"로 읽어 첫 프레임에
  // 빈 상태 문구를 그린다 — 목록을 아직 모르는 것과 목록이 비어 있는 것은 다르다(#94).
  return { items, isLoading: !hydrated || listQuery.isLoading };
}

export type ItemViewStatus = "loading" | "not-found" | "ready";

/**
 * S4 주문 전 확인 / S5 관심종목 상세가 쓰는 1건 조회.
 *
 * S1에서 넘어온 경우 필요한 것이 이미 목록 캐시에 있으므로 **DB를 다시 부르지 않는다**
 * — 예전에는 두 화면 모두 `useEffect`에서 서버 액션을 직접 불러 매번 ~800ms 동안 빈
 * 화면을 보여줬다. 캐시에 없을 때(hard-nav로 URL 직접 진입)만 1건짜리 서버 액션으로
 * 폴백한다. "캐시에 있다"는 양성 신호지만 "없다"는 부재의 증거가 아니라서, 캐시 미스를
 * 곧바로 not-found로 해석하지 않는다.
 *
 * 목록 캐시는 `getQueryData`로 **구독 없이** 읽는다. `useQuery`로 구독하면 미스일 때
 * 목록 전체(N종목 + 근거 + 전제)를 끌어오는데, 콜드 경로에서는 1건짜리 조회가 더 싸다.
 *
 * 시세는 캐시 값으로 즉시 그리되 한 번 재검증한다(`refetchOnMount: "always"`).
 * 시세 쿼리에는 `refetchInterval`이 없고 S4는 인터셉트 모달이라 S1이 언마운트되지
 * 않으므로, 재검증하지 않으면 캐시된 시세가 20초가 아니라 S1을 열어둔 시간만큼
 * 오래될 수 있다. 반환하는 `quoteSettled`가 그 재검증이 끝났는지를 알려준다 —
 * S4는 이 값을 `useFrozen`에 넘겨 재검증된 시세에 고정한다(ADR-0005).
 */
export function useWatchlistItemView(
  ticker: string,
  scenario: DemoScenario,
  hydrated: boolean
) {
  const queryClient = useQueryClient();

  // 캐시 경로/콜드 경로 중 무엇을 탈지는 마운트 시점에 한 번만 정한다. 매 렌더마다 다시
  // 판단하면 배경에서 목록 캐시가 채워지는 순간 경로가 바뀌어 시세가 두 번 정착한다.
  // (`hydrated`로 막지 않는다 — 목록 캐시의 존재 여부는 데모 시점과 무관하다.)
  const [cachedList] = useState<WatchlistListItem[]>(
    () => queryClient.getQueryData<WatchlistListItem[]>(LIST_KEY) ?? []
  );
  const cachedItem = cachedList.find((i) => i.ticker === ticker) ?? null;

  const quoteTargets = useMemo(
    () => cachedList.map((item) => ({ ticker: item.ticker, isSeed: item.isSeed })),
    [cachedList]
  );
  const tickerKey = toTickerKey(quoteTargets);

  // S1과 같은 쿼리 키를 쓴다 — 재검증 결과가 S1의 가격에도 반영되어 캐시가 갈라지지
  // 않는다. KIS 조회는 배치라 N종목이 1회 호출이므로 티커 하나만 따로 부를 이유도 없다.
  const quotesQuery = useQuery({
    queryKey: quotesKey(scenario, tickerKey),
    queryFn: () => loadWatchlistQuotes(quoteTargets, scenario),
    enabled: hydrated && cachedItem != null && quoteTargets.length > 0,
    staleTime: QUOTES_STALE_TIME_MS,
    refetchOnMount: "always",
  });

  // 콜드 경로: 목록 캐시에 없는 종목. 합성된 1건을 받아 목록/시세로 되쪼갠다.
  const [cold, setCold] = useState<
    { status: "loading" } | { status: "not-found" } | { status: "ready"; item: SettledWatchlistItem }
  >({ status: "loading" });
  const coldStartedRef = useRef(false);
  const needsCold = hydrated && cachedItem == null;

  useEffect(() => {
    if (!needsCold || coldStartedRef.current) return;
    coldStartedRef.current = true;
    getWatchlistItemDetailAction(ticker, scenario).then((item) => {
      setCold(item ? { status: "ready", item } : { status: "not-found" });
    });
  }, [needsCold, ticker, scenario]);

  if (cachedItem) {
    return {
      status: "ready" as ItemViewStatus,
      listItem: cachedItem,
      quote: quoteStateFor(ticker, quotesQuery.data, quotesQuery.isError, quotesQuery.isFetching),
      // 재검증이 끝나야 고정해도 되는 값이 된다.
      quoteSettled: !quotesQuery.isFetching,
    };
  }

  if (!hydrated || cold.status === "loading") {
    return {
      status: "loading" as ItemViewStatus,
      listItem: null,
      quote: QUOTE_LOADING,
      quoteSettled: false,
    };
  }

  if (cold.status === "not-found") {
    // 그릴 종목 자체가 없다. 시세 상태는 호출부가 보지 않지만 "결판났다"는 쪽에 맞춘다.
    return {
      status: "not-found" as ItemViewStatus,
      listItem: null,
      quote: QUOTE_FAILED,
      quoteSettled: true,
    };
  }

  // 콜드 경로 결과는 이미 조회 시점의 시세라 재검증할 것이 없다 — 서버가 돌려준 `null`은
  // 순수하게 조회 실패다.
  const { quote, ...listItem } = cold.item;
  return {
    status: "ready" as ItemViewStatus,
    listItem: listItem as WatchlistListItem,
    quote: settledQuote(quote),
    quoteSettled: true,
  };
}
