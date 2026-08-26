// S4 주문 전 확인의 취소/구매/시트닫기/근거갱신 4개 분기 모두에서 order_events를
// 남긴다 (지도 #38 destination, 화면명세_v2.md S4). watchlist_item→bought 전환은
// 이 맵의 범위 밖(KIS 모의투자 주문 연동 자체가 범위 밖) — insert만 한다.

import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";

export type OrderEventAction = "proceed" | "adjust" | "cancel" | "update_thesis";

export interface OrderEventInput {
  watchlistItemId: string;
  thesisShown: boolean;
  initialQty: number;
  finalQty: number;
  action: OrderEventAction;
}

export async function recordOrderEvent(input: OrderEventInput): Promise<void> {
  return withSession(async (sessionId) => {
    await db.insert(orderEvents).values({ sessionId, ...input });
  });
}

/**
 * 근거가 뜨기 전에 시트를 닫은 경우 — 클라이언트가 아직 `watchlistItemId`를 모른다.
 * 티커로 서버에서 찾아 남긴다.
 *
 * 클라이언트에서 진행 중인 조회를 await한 뒤 기록하는 방법은 쓸 수 없다: 나가기는
 * `router.back()`으로 컴포넌트를 언마운트시키므로 그 continuation이 실행되지 않는다.
 * "근거를 못 본 채 나갔다"는 이 제품이 가장 알고 싶어 하는 신호 중 하나라 유실을
 * 허용하지 않는다(`thesisShown: false`가 그 사실을 그대로 표현한다).
 */
export async function recordOrderEventByTicker(
  input: Omit<OrderEventInput, "watchlistItemId"> & { ticker: string }
): Promise<void> {
  const { ticker, ...rest } = input;
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
      );
    // 세션의 관심종목이 아니면 남길 대상이 없다 — 조용히 무시한다.
    if (!item) return;
    await db.insert(orderEvents).values({ sessionId, watchlistItemId: item.id, ...rest });
  });
}
