// S4 주문 전 확인의 실 데이터 조회 (지도 #38 destination). getWatchlistView(S1)와 달리
// evaluateWatchlistPremises를 돌리지 않는다 — S4는 전제를 "판정"하지 않고 마지막으로
// 판정된 premises.status를 그대로 "읽기"만 한다 (판정 트리거는 S1 로드/S5 진입뿐).

import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";
import { evaluateItemPremises } from "@/lib/premises/engine";
import { fetchLatestTheses, resolveQuotes, type WatchlistViewItem } from "./get-watchlist";

export type { WatchlistViewItem };

/** 세션이 소유한(watching/bought) 관심종목 중 ticker와 일치하는 1건. 없으면 null. */
export async function getWatchlistItemForOrder(
  ticker: string,
  isFuture: boolean
): Promise<WatchlistViewItem | null> {
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
      resolveQuotes([item], isFuture),
    ]);

    return {
      id: item.id,
      ticker: item.ticker,
      name: item.name,
      status: item.status as WatchlistViewItem["status"],
      isSeed: item.isSeed,
      addedPrice: item.addedPrice != null ? Number(item.addedPrice) : 0,
      addedAt: item.addedAt?.toISOString() ?? item.createdAt.toISOString(),
      avgBuyPrice: item.avgBuyPrice != null ? Number(item.avgBuyPrice) : undefined,
      boughtAt: item.boughtAt?.toISOString(),
      thesis: theseByItem.get(item.id),
      quote: quotes.get(item.ticker) ?? null,
    };
  });
}

/**
 * S5 상세 진입: 해당 종목만 단건 재판정(`evaluateItemPremises`)한 뒤 최신 상태를 읽는다.
 * S4(`getWatchlistItemForOrder`)와 달리 판정을 다시 돌린다 — 상세 진입이 그 트리거다.
 */
export async function getWatchlistItemDetail(
  ticker: string,
  isFuture: boolean
): Promise<WatchlistViewItem | null> {
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

    await evaluateItemPremises(sessionId, item.id, isFuture);

    const [theseByItem, quotes] = await Promise.all([
      fetchLatestTheses([item.id]),
      resolveQuotes([item], isFuture),
    ]);

    return {
      id: item.id,
      ticker: item.ticker,
      name: item.name,
      status: item.status as WatchlistViewItem["status"],
      isSeed: item.isSeed,
      addedPrice: item.addedPrice != null ? Number(item.addedPrice) : 0,
      addedAt: item.addedAt?.toISOString() ?? item.createdAt.toISOString(),
      avgBuyPrice: item.avgBuyPrice != null ? Number(item.avgBuyPrice) : undefined,
      boughtAt: item.boughtAt?.toISOString(),
      thesis: theseByItem.get(item.id),
      quote: quotes.get(item.ticker) ?? null,
    };
  });
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
