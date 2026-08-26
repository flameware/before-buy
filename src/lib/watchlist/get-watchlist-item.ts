// S4 주문 전 확인의 실 데이터 조회 (지도 #38 destination). getWatchlistView(S1)와 달리
// evaluateWatchlistPremises를 돌리지 않는다 — S4는 전제를 "판정"하지 않고 마지막으로
// 판정된 premises.status를 그대로 "읽기"만 한다 (판정 트리거는 S1 로드/S5 진입뿐).

import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";
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
