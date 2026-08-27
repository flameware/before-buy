// S4 주문 전 확인 / S5 관심종목 상세의 실 데이터 조회 (지도 #38 destination).
//
// ADR-0004: 두 화면 모두 자기가 그리는 시세로 전제 상태를 계산한다. 예전에는 "판정
// 트리거는 S1 로드/S5 진입뿐이고 S4는 마지막 판정 결과를 읽기만 한다"는 규칙이 있었으나,
// 판정이 DB 쓰기였기 때문에 둔 방어선이었고 순수 계산이 된 지금은 의미가 없다. 그 규칙
// 아래에서는 `3개월 후`로 보는 중에 시트를 열면 `현재` 기준 상태를 읽어, 전제가 깨졌는데도
// "생각이 바뀌셨나요?" 링크가 뜨지 않았다.

import "server-only";
import { and, eq, inArray } from "drizzle-orm";
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
    const [item] = await db
      .select()
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.sessionId, sessionId),
          eq(watchlistItems.ticker, ticker),
          inArray(watchlistItems.status, ["watching", "bought"])
        )
      );
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
 */
export async function removeWatchlistItem(ticker: string): Promise<void> {
  return withSession(async (sessionId) => {
    await db
      .update(watchlistItems)
      .set({ status: "removed" })
      .where(and(eq(watchlistItems.sessionId, sessionId), eq(watchlistItems.ticker, ticker)));
  });
}
