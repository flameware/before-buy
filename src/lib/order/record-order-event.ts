// S4 주문 전 확인의 취소/구매/시트닫기/근거갱신 4개 분기 모두에서 order_events를
// 남긴다 (지도 #38 destination, 화면명세_v2.md S4). watchlist_item→bought 전환은
// 이 맵의 범위 밖(KIS 모의투자 주문 연동 자체가 범위 밖) — insert만 한다.

import "server-only";
import { db } from "@/lib/db";
import { orderEvents } from "@/lib/db/schema";
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
