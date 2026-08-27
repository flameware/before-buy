// S4 주문 전 확인 / S5 관심종목 상세의 실 데이터 조회 (지도 #38 destination).
//
// ADR-0004: 두 화면 모두 자기가 그리는 시세로 전제 상태를 계산한다. 예전에는 "판정
// 트리거는 S1 로드/S5 진입뿐이고 S4는 마지막 판정 결과를 읽기만 한다"는 규칙이 있었으나,
// 판정이 DB 쓰기였기 때문에 둔 방어선이었고 순수 계산이 된 지금은 의미가 없다. 그 규칙
// 아래에서는 `3개월 후`로 보는 중에 시트를 열면 `현재` 기준 상태를 읽어, 전제가 깨졌는데도
// "생각이 바뀌셨나요?" 링크가 뜨지 않았다.

import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";
import { resolvePremises } from "@/lib/premises/engine";
import type { DemoScenario, QuoteSnapshot, Thesis } from "@/lib/mock/types";
import { fetchLatestTheses, resolveQuotes, type SettledWatchlistItem } from "./get-watchlist";

export type { SettledWatchlistItem };

/**
 * S4 주문 전 확인: 세션이 소유한(watching/bought) 관심종목 중 ticker와 일치하는 1건.
 * 없으면 null.
 */
export async function getWatchlistItemForOrder(
  ticker: string,
  scenario: DemoScenario
): Promise<SettledWatchlistItem | null> {
  return loadItem(ticker, scenario);
}

/** S5 관심종목 상세. S4와 같은 조회다 — 판정이 계산이 된 뒤로 둘을 가를 이유가 없다. */
export async function getWatchlistItemDetail(
  ticker: string,
  scenario: DemoScenario
): Promise<SettledWatchlistItem | null> {
  return loadItem(ticker, scenario);
}

async function loadItem(
  ticker: string,
  scenario: DemoScenario
): Promise<SettledWatchlistItem | null> {
  return withSession(async (sessionId) => {
    // 티커 하나에 항목 하나가 모델이지만(#98), "1건"을 정렬 없이 뽑는 쿼리는 그 모델이
    // 지켜지는지에 목숨을 건다. 옛 중복이 남아 있으면 DB가 돌려주는 순서에 따라 같은 화면이
    // 두 번 열릴 때 다른 근거를 보여준다. `commitThesis`의 재사용 선택과 같은 기준(먼저 담은
    // 행)으로 끊는다.
    const [item] = await db
      .select()
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.sessionId, sessionId),
          eq(watchlistItems.ticker, ticker),
          inArray(watchlistItems.status, ["watching", "bought"])
        )
      )
      .orderBy(asc(watchlistItems.createdAt), asc(watchlistItems.id))
      .limit(1);
    if (!item) return null;

    const [theseByItem, quotes] = await Promise.all([
      fetchLatestTheses([item.id]),
      resolveQuotes([item], scenario),
    ]);

    const quote = quotes.get(item.ticker) ?? null;

    return {
      id: item.id,
      ticker: item.ticker,
      name: item.name,
      status: item.status as SettledWatchlistItem["status"],
      isSeed: item.isSeed,
      addedPrice: item.addedPrice != null ? Number(item.addedPrice) : 0,
      addedAt: item.addedAt?.toISOString() ?? item.createdAt.toISOString(),
      avgBuyPrice: item.avgBuyPrice != null ? Number(item.avgBuyPrice) : undefined,
      boughtAt: item.boughtAt?.toISOString(),
      thesis: withResolvedPremises(theseByItem.get(item.id), quote),
      quote,
    };
  });
}

/** 근거가 없으면 그대로 통과. 있으면 자동 전제 상태를 이 시세 기준으로 확정한다. */
function withResolvedPremises(
  thesis: Thesis | undefined,
  quote: QuoteSnapshot | null
): Thesis | undefined {
  if (!thesis) return undefined;
  return { ...thesis, premises: resolvePremises(thesis.premises, quote) };
}

/**
 * "관심종목에서 제외": 인메모리 삭제 대신 `status = 'removed'`로 실제 update.
 * 세션 소유가 아닌 항목은 조용히 무시(0-row update)한다.
 *
 * **계약은 "1건 제외"가 아니라 "이 티커 전부 제외"다** — 티커로 매칭되는 세션 소유 행
 * 전부의 status를 바꾼다. 근거 갱신이 항목을 복제하지 않게 된 뒤로(#98) 실질 차이는
 * 없지만, 그 이전에 쌓인 중복까지 한 번에 정리하는 것이 이 함수의 동작이다.
 *
 * **실제로 뺀 티커를 돌려준다** (#107, ADR-0010) — 호출부는 이 응답을 받아야 S1 목록
 * 캐시에서 그 종목을 뺄 수 있다. 0-row였다면 `null`이고, 그때 캐시를 건드리면 서버가
 * 확정하지 않은 사실을 화면이 주장하게 된다.
 */
export async function removeWatchlistItem(ticker: string): Promise<string | null> {
  return withSession(async (sessionId) => {
    const removed = await db
      .update(watchlistItems)
      .set({ status: "removed" })
      .where(and(eq(watchlistItems.sessionId, sessionId), eq(watchlistItems.ticker, ticker)))
      .returning({ ticker: watchlistItems.ticker });
    return removed[0]?.ticker ?? null;
  });
}

/**
 * S2가 진입 시점에 묻는 것: 이 종목이 이미 세션의 관심종목인가? (#96)
 *
 * 시세도 근거도 붙이지 않는다 — 답이 필요한 곳은 "건너뛰기 버튼을 그릴까"뿐이고,
 * 그 판정을 loadItem에 맡기면 화면에 쓰지도 않을 KIS 왕복을 S2 진입마다 태우게 된다.
 * 클라이언트의 S1 목록 캐시로 대신하지 않는 이유는 정합성이다 — 직접 URL 진입이나
 * 새로고침에는 그 캐시가 없고, 그러면 이미 담긴 종목에 건너뛰기가 뜨는 순간 근거 있는
 * 카드 옆에 "근거 없음" 카드가 하나 더 생긴다.
 */
export async function isTickerWatched(ticker: string): Promise<boolean> {
  return withSession(async (sessionId) => {
    const [item] = await db
      .select({ id: watchlistItems.id })
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.sessionId, sessionId),
          eq(watchlistItems.ticker, ticker),
          inArray(watchlistItems.status, ["watching", "bought"])
        )
      )
      .limit(1);
    return !!item;
  });
}
