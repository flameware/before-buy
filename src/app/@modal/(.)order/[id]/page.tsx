"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { OrderConfirmContent } from "@/components/order/order-confirm-content";
import { findStock } from "@/lib/mock";

// S4 주문 전 확인 — `/` 등에서 `구매`를 눌렀을 때 뜨는 bottom sheet.
// (..)order를 가로채 @modal 슬롯에서 렌더한다 (`/order/[id]`가 하드 내비게이션 폴백).
export default function OrderModal({ params }: PageProps<"/order/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const stock = findStock(id);
  if (!stock) return null;

  return (
    <Drawer open onOpenChange={(open) => !open && router.back()} showSwipeHandle>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>주문 전 확인</DrawerTitle>
        </DrawerHeader>
        <OrderConfirmContent ticker={stock.ticker} stockName={stock.name} />
      </DrawerContent>
    </Drawer>
  );
}
