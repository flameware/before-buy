"use client";

import { Minus, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScreenHeader } from "@/components/layout/screen-header";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { useFrozen } from "@/hooks/use-frozen";
import { useUnsupportedTradeToast } from "@/hooks/use-unsupported-trade-toast";
import { snapshotOf, type QuoteState } from "@/lib/quote/quote-state";
import { useWatchlistItemView } from "@/hooks/use-watchlist-view";
import { composeView } from "@/lib/watchlist/compose-view";
import { getCategory } from "@/lib/mock";
import { badgeDisplay } from "@/lib/premises/badge";
import { recordOrderEventAction, recordOrderEventByTickerAction } from "@/app/actions";
import type { OrderEventAction } from "@/lib/order/record-order-event";

const priceFormat = new Intl.NumberFormat("ko-KR");
const INITIAL_QTY = 1;

function formatPrice(price: number): string {
  return `${priceFormat.format(price)}원`;
}

/**
 * S4 본문 — Drawer(소프트 내비게이션)와 전체 페이지(하드 내비게이션 폴백) 양쪽에서
 * 공유한다. 취소 버튼/외부 탭(Drawer)/헤더 뒤로가기(전체 페이지) 모두 같은 "나가기"
 * 경로(handleExit)를 타도록 Drawer/ScreenHeader까지 이 컴포넌트가 직접 소유한다 —
 * order_events cancel을 남기는 데 필요한 상태(수량, 종목)가 여기 한 곳에만 있고,
 * 부모 컴포넌트로 ref를 넘기는 대신 이렇게 하면 각 나가기 지점에서 명시적으로
 * 한 번만 기록하면 된다.
 *
 * 데이터는 `useWatchlistItemView`가 S1의 목록 캐시에서 읽는다. S1에서 넘어온 경우
 * 근거·전제·종목명은 **첫 프레임부터 완성**되어 있고, 시세만 한 번 재확인한 뒤
 * `useFrozen`으로 고정된다(ADR-0005) — 이 화면은 목록이 아니라 결정 지점이라
 * `구매`를 누르기 직전에 합계가 손 밑에서 바뀌어서는 안 된다.
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
  const notifyUnsupportedTrade = useUnsupportedTradeToast();
  const [qty, setQty] = useState(INITIAL_QTY);
  const recordedRef = useRef(false);

  const { status, listItem, quote, quoteSettled } = useWatchlistItemView(
    ticker,
    scenario,
    hydrated
  );

  // 재검증된 시세에 고정한다. 고정 전에는 캐시 값이 그대로 통과하므로 화면이 비지 않는다.
  // 고정 대상은 스냅샷뿐이다 — "조회 중"은 애초에 붙잡아 둘 값이 아니라서, 아직 고정된
  // 스냅샷이 없으면 훅이 알려준 상태(조회 중/실패)를 그대로 흘려보낸다.
  const frozenSnapshot = useFrozen(snapshotOf(quote), quoteSettled);
  const frozenQuote: QuoteState = frozenSnapshot ? { state: "ok", snapshot: frozenSnapshot } : quote;
  const item = listItem ? composeView(listItem, frozenQuote) : null;

  function record(action: OrderEventAction) {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const common = { thesisShown: !!item?.thesis, initialQty: INITIAL_QTY, finalQty: qty, action };
    if (item) {
      void recordOrderEventAction({ watchlistItemId: item.id, ...common });
      return;
    }
    // 아직 로딩 중이라 watchlistItemId를 모른다 — 서버가 티커로 찾아 남긴다.
    void recordOrderEventByTickerAction({ ticker, ...common });
  }

  function handleExit() {
    // 근거가 뜨기 전에 나간 것도 남길 값어치가 있는 사건이다 — 예전에는 watchlistItemId를
    // 아직 몰라 조용히 버려졌다. 화면 이탈은 기록을 기다리지 않는다.
    record("cancel");
    router.back();
  }

  function handleBuy() {
    // 주문 실행은 프로토타입 범위 밖이지만 **기록은 반드시 남긴다**(#105). `proceed`/`adjust`는
    // 이 제품의 핵심 지표 — "근거를 본 뒤 수량을 조정했는가"(가설 2, 화면명세 S4)이고,
    // 여기를 토스트로 갈아치우면 order_events에는 cancel과 update_thesis만 쌓인다.
    record(qty === INITIAL_QTY ? "proceed" : "adjust");
    // 홈으로 보내지 않는다 — 아무 일도 일어나지 않았는데 "담긴 종목이 강조된 홈"으로
    // 돌아가면 화면이 주문이 체결된 척을 한다. 시트는 열린 채로 두고 사실만 말한다.
    notifyUnsupportedTrade("buy");
  }

  function handleUpdateThesis() {
    record("update_thesis");
    router.push(`/thesis/${ticker}`);
  }

  function shell(children: React.ReactNode) {
    if (variant === "modal") {
      return (
        <Drawer open onOpenChange={(open) => !open && handleExit()} showSwipeHandle>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>주문 전 확인</DrawerTitle>
            </DrawerHeader>
            {children}
          </DrawerContent>
        </Drawer>
      );
    }
    return (
      <>
        <ScreenHeader title="주문 전 확인" onBack={handleExit} />
        {children}
      </>
    );
  }

  if (status === "not-found") {
    // 세션의 관심종목이 아닌 티커(제거됐거나 애초에 담은 적 없음)로 접근한 경우.
    // order_events를 남길 watchlist_item_id가 없어 여기서 더 진행할 수 없다.
    return shell(
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        관심종목에서 찾을 수 없는 종목이에요.
      </div>
    );
  }

  const loading = status === "loading" || !item;

  // 근거 카드 자리를 skeleton에서도 잡아둔다. 콜드 경로에서는 그 종목에 근거가 있는지
  // 로드 전에 알 수 없고(`findStock`은 mock 조회라 DB의 thesis를 모른다), 근거 있음이
  // 다수 경로다. 실제 본문과 같은 높이를 만들어 drawer의 450ms height 트랜지션이
  // 탈 구간을 없애는 것이 이 skeleton의 목적이다.
  const thesis = item?.thesis;
  // 매수 직전 화면이라 확신을 지어내지 않는 것이 특히 중요하다 — 시세를 못 불러와 전제를
  // 판정할 수 없으면 "유지"라고 말하지 않고 그렇게 말한다(#81). 그래도 **매수는 막지
  // 않는다**: 판정 불가는 사용자의 결정을 대신 내릴 근거가 아니다.
  const badge = item ? badgeDisplay(item, item.quote) : null;
  const changed = badge?.kind === "badge" && badge.state === "changed";

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <div className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">전제 상태</span>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </div>
        ) : thesis ? (
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
              {badge?.kind === "pending" ? (
                <Skeleton className="h-5 w-12 rounded-full" />
              ) : badge?.kind === "unknown" ? (
                <Badge variant="outline">확인 불가</Badge>
              ) : (
                <Badge variant={changed ? "destructive" : "secondary"}>
                  {changed ? "달라짐" : "유지"}
                </Badge>
              )}
            </div>
            {badge?.kind === "unknown" ? (
              <p className="text-xs text-muted-foreground">
                시세를 불러오지 못해 지금은 근거가 유효한지 확인할 수 없어요.
              </p>
            ) : null}
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

        {/* 종목명·수량·버튼은 fetch 없이 첫 프레임부터 그린다 — 수량 조절은 가격을 몰라도
            의미가 있고, 버튼 바가 처음부터 자리를 잡아야 시트 높이가 흔들리지 않는다. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{stockName}</span>
            {loading || item.quote.state === "loading" ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <span className="text-sm text-muted-foreground">
                {item.quote.state === "ok" ? formatPrice(item.quote.snapshot.price) : "시세 조회 실패"}
              </span>
            )}
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
            {loading || item.quote.state === "loading" ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <span>
                {item.quote.state === "ok"
                  ? formatPrice(item.quote.snapshot.price * qty)
                  : "시세 조회 실패"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={handleExit}>
          취소
        </Button>
        {/* 근거가 뜨기 전에 살 수 있으면 이 화면의 존재 이유가 무너진다. 나가기는 언제나 열어둔다. */}
        <Button variant="buy" size="lg" className="flex-1" onClick={handleBuy} disabled={loading}>
          구매
        </Button>
      </div>
    </div>
  );

  return shell(body);
}
