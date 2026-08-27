// S2 Step 1 "건너뛰기": 근거를 쓰지 않고 종목만 담는다 (#96).
//
// commitThesis와 대비되는 자리다 — 저쪽은 watchlist_item + thesis + critique +
// premises를 한 배치로 심고, 이쪽은 watchlist_item 1건만 심는다. 근거가 없으므로
// 배지는 "근거 없음"으로 확정된다(시드 C·LG에너지솔루션과 같은 상태).
//
// 시세를 여기서 한 번 조회하는 이유: 담은 날 가격은 근거와 무관한 사실이고, 지금
// 놓치면 나중에 근거를 써도 영영 복구되지 않는다. 반대로 **시세 실패가 담기를 막지는
// 않는다** — addedPrice를 null로 두고 담는다. 조회 계층이 이 null을 0으로 접고
// returnSinceAdded가 0을 null로 돌려주므로, 화면은 담은 날 대비를 조용히 감춘다.

import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";
import { getKoreanStockPrices } from "@/lib/kis/batch-quote";
import { resolveStock } from "@/lib/stock/resolve-stock";
import type { QuoteSnapshot } from "@/lib/mock/types";
import type { SettledWatchlistItem } from "./get-watchlist";

/**
 * 담은 행을 그대로 돌려준다 (#107, ADR-0010). DB를 다시 읽지 않는다 — 심을 값이 이미
 * 전부 여기 있으므로, 조립을 **이 함수 안에서** 하고 반환 타입으로 모양을 못박으면
 * 호출부가 `getWatchlistListView`가 돌려줬을 모양과 어긋날 여지가 없다.
 *
 * `addedPrice`가 `null`을 0으로 접는 것은 조회 계층과 같은 규칙이다(`get-watchlist.ts`).
 * 두 곳이 다른 모양을 돌려주면 재검증 전후로 담은 날 대비가 달라 보인다.
 */
export async function addWatchlistItemWithoutThesis(ticker: string): Promise<SettledWatchlistItem> {
  return withSession(async (sessionId) => {
    // 이름을 모르면 티커가 그대로 name에 들어간다 — resolveStock은 실패하지 않는다 (#92).
    const [stock, quotes] = await Promise.all([
      resolveStock(ticker),
      getKoreanStockPrices([ticker]),
    ]);

    const result = quotes.get(ticker);
    const quote: QuoteSnapshot | null = result?.ok
      ? {
          price: result.data.price,
          changePercent: result.data.changePercent ?? 0,
          per: result.data.per,
          pbr: result.data.pbr,
        }
      : null;

    const id = randomUUID();
    const addedAt = new Date();

    await db.insert(watchlistItems).values({
      id,
      sessionId,
      ticker,
      name: stock.name,
      status: "watching",
      addedPrice: quote ? String(quote.price) : null,
      addedAt,
      isSeed: false,
    });

    return {
      id,
      ticker,
      name: stock.name,
      status: "watching",
      isSeed: false,
      addedPrice: quote?.price ?? 0,
      addedAt: addedAt.toISOString(),
      quote,
    };
  });
}
