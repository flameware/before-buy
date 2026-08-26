"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScreenHeader } from "@/components/layout/screen-header";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { badgeState, getCategory } from "@/lib/mock";
import { getOrderConfirmItemAction, recordOrderEventAction } from "@/app/actions";
import type { OrderEventAction } from "@/lib/order/record-order-event";
import type { WatchlistViewItem } from "@/lib/watchlist/get-watchlist-item";

const priceFormat = new Intl.NumberFormat("ko-KR");
const INITIAL_QTY = 1;

function formatPrice(price: number): string {
  return `${priceFormat.format(price)}원`;
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; item: WatchlistViewItem };

/**
 * S4 본문 — Drawer(소프트 내비게이션)와 전체 페이지(하드 내비게이션 폴백) 양쪽에서
 * 공유한다. 취소 버튼/외부 탭(Drawer)/헤더 뒤로가기(전체 페이지) 모두 같은 "나가기"
 * 경로(handleExit)를 타도록 Drawer/ScreenHeader까지 이 컴포넌트가 직접 소유한다 —
 * order_events cancel을 남기는 데 필요한 상태(수량, 종목)가 여기 한 곳에만 있고,
 * 부모 컴포넌트로 ref를 넘기는 대신 이렇게 하면 각 나가기 지점에서 명시적으로
 * 한 번만 기록하면 된다.
 */
export function OrderConfirmContent({
  ticker,
  stockName,
  variant,
}: {
  ticker: string;
  stockName: string;
  variant: "modal" | "page";
}) {
  const router = useRouter();
  const { scenario, hydrated } = useDemoScenario();
  const [qty, setQty] = useState(INITIAL_QTY);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const loadingRef = useRef(false);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || loadingRef.current) return;
    loadingRef.current = true;
    getOrderConfirmItemAction(ticker, scenario).then((item) => {
      setState(item ? { status: "ready", item } : { status: "not-found" });
    });
  }, [ticker, scenario, hydrated]);

  function record(action: OrderEventAction) {
    if (recordedRef.current || state.status !== "ready") return;
    recordedRef.current = true;
    void recordOrderEventAction({
      watchlistItemId: state.item.id,
      thesisShown: !!state.item.thesis,
      initialQty: INITIAL_QTY,
      finalQty: qty,
      action,
    });
  }

  function handleExit() {
    record("cancel");
    router.back();
  }

  function handleBuy() {
    record(qty === INITIAL_QTY ? "proceed" : "adjust");
    router.push(`/?highlight=${ticker}`);
  }

  function handleUpdateThesis() {
    record("update_thesis");
    router.push(`/thesis/${ticker}`);
  }

  if (state.status === "not-found") {
    // 세션의 관심종목이 아닌 티커(제거됐거나 애초에 담은 적 없음)로 접근한 경우.
    // order_events를 남길 watchlist_item_id가 없어 여기서 더 진행할 수 없다.
    const message = (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        관심종목에서 찾을 수 없는 종목이에요.
      </div>
    );
    return variant === "modal" ? (
      <Drawer open onOpenChange={(open) => !open && router.back()} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>주문 전 확인</DrawerTitle>
          </DrawerHeader>
          {message}
        </DrawerContent>
      </Drawer>
    ) : (
      <>
        <ScreenHeader title="주문 전 확인" />
        {message}
      </>
    );
  }

  if (state.status === "loading") {
    return variant === "modal" ? (
      <Drawer open onOpenChange={(open) => !open && router.back()} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>주문 전 확인</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    ) : null;
  }

  const { item } = state;
  const quote = item.quote;
  const thesis = item.thesis;
  const hasThesis = !!thesis;
  const changed = hasThesis && badgeState(item) === "changed";

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {hasThesis && thesis ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">3주 전에 이렇게 생각하셨어요</p>
            <div className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <p className="text-sm font-medium">{getCategory(thesis.category).label}</p>
              <p className="text-xs text-muted-foreground">
                {thesis.freeText ?? "몇 가지 질문에 답하며 담았어요."}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">전제 상태</span>
              <Badge variant={changed ? "destructive" : "secondary"}>
                {changed ? "달라짐" : "유지"}
              </Badge>
            </div>
            {changed ? (
              <button
                type="button"
                onClick={handleUpdateThesis}
                className="text-left text-sm text-primary underline"
              >
                생각이 바뀌셨나요?
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{stockName}</span>
            <span className="text-sm text-muted-foreground">
              {quote ? formatPrice(quote.price) : "시세 조회 실패"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">수량</span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="수량 줄이기"
              >
                <Minus />
              </Button>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setQty((q) => q + 1)}
                aria-label="수량 늘리기"
              >
                <Plus />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>합계</span>
            <span>{quote ? formatPrice(quote.price * qty) : "시세 조회 실패"}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" className="flex-1" onClick={handleExit}>
          취소
        </Button>
        <Button className="flex-1" onClick={handleBuy}>
          구매
        </Button>
      </div>
    </div>
  );

  if (variant === "modal") {
    return (
      <Drawer open onOpenChange={(open) => !open && handleExit()} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>주문 전 확인</DrawerTitle>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <>
      <ScreenHeader title="주문 전 확인" onBack={handleExit} />
      {body}
    </>
  );
}
