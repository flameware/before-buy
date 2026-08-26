"use client";

import { use } from "react";
import { OrderConfirmContent } from "@/components/order/order-confirm-content";
import { findStock } from "@/lib/mock";

// S4 주문 전 확인 — `/` 등에서 `구매`를 눌렀을 때 뜨는 bottom sheet.
// (..)order를 가로채 @modal 슬롯에서 렌더한다 (`/order/[id]`가 하드 내비게이션 폴백).
// Drawer 자체는 OrderConfirmContent(variant="modal")가 소유한다 — 취소 버튼/외부
// 탭/스와이프가 모두 같은 "나가기" 경로를 타야 order_events cancel이 정확히 한 번만
// 남기 때문.
export default function OrderModal({ params }: PageProps<"/order/[id]">) {
  const { id } = use(params);
  const stock = findStock(id);
  if (!stock) return null;

  return <OrderConfirmContent ticker={stock.ticker} stockName={stock.name} variant="modal" />;
}
