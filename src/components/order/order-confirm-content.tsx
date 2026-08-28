"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
 * order_events를 한 번만 남기는 `recordedRef`가 여기 한 곳에만 있고, 부모 컴포넌트로
 * ref를 넘기는 대신 이렇게 하면 각 나가기 지점에서 명시적으로 한 번만 기록하면 된다.
 *
 * **이 화면이 확인시키는 것은 담을 때 적어둔 전제뿐이다** — 수량·합계는 뒤에 있을 실제
 * 주문 화면의 몫이라 여기 두지 않는다(#143). 종목명과 현재가만 남는 이유는 "무엇을 지금
 * 얼마에 사려는가"가 전제를 읽는 문맥이기 때문이고, 그 이상은 S5와의 중복이 된다.
 *
 * 데이터는 `useWatchlistItemView`가 S1의 목록 캐시에서 읽는다. S1에서 넘어온 경우
 * 근거·전제·종목명은 **첫 프레임부터 완성**되어 있고, 시세만 한 번 재확인한 뒤
 * `useFrozen`으로 고정된다(ADR-0005) — 이 화면은 목록이 아니라 결정 지점이라
 * `구매`를 누르기 직전에 판정 근거가 손 밑에서 바뀌어서는 안 된다.
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
    // 수량은 이 화면을 떠났지만 컬럼은 남겨둔다 — 죽은 지표 하나 때문에 스키마를
    // 떨어뜨리면 되돌리는 비용이 지우는 비용보다 크다(#143). 두 값은 늘 같으므로
    // `adjust`는 이제 어느 분기에서도 발생하지 않는다.
    const common = {
      thesisShown: !!item?.thesis,
      initialQty: INITIAL_QTY,
      finalQty: INITIAL_QTY,
      action,
    };
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
    // 주문 실행은 프로토타입 범위 밖이지만 **기록은 반드시 남긴다**(#105) — 여기를
    // 토스트로 갈아치우면 order_events에는 cancel과 update_thesis만 쌓이고, "근거를
    // 보고도 그대로 샀다"는 대조군이 통째로 사라진다.
    record("proceed");
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

  // `!hydrated`도 로딩으로 접는다. 하이드레이션 전에는 데모 시점을 아직 모르므로 손에
  // 들린 캐시가 `현재` 기준일 수 있고, 그 시세로 계산한 전제 배지는 틀릴 수 있다. 고정은
  // 이제 재검증을 기다리지만(#141), **그리는 것**까지 막히지는 않는다 — 결정 지점 화면이
  // `유지`를 한 프레임 보여줬다가 `달라짐`으로 뒤집는 것은 고정을 도입한 이유(ADR-0005)와
  // 같은 이유로 안 된다. S1도 같은 게이트를 쓴다(`useWatchlistView`의 `isLoading`).
  const loading = status === "loading" || !hydrated || !item;

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
      {/* `DrawerHeader`가 `pb-0`이라 위쪽 여백은 본문이 만든다. 헤더를 고치면 앱의 다른
          Drawer가 함께 움직이므로 여기서 잡고, 값은 본문이 이미 쓰는 `gap-4`와 맞춘다. */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
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
            {changed ? (
              /* **깨진 전제가 근거 요약을 대체한다.** 매수 직전에 필요한 것은 "저평가라고
                 생각했다"가 아니라 "PER 15배가 지금 22배다"이고, 옛 생각을 먼저 세우면
                 틀어진 사실이 그 뒤에 놓인다(#143). `유지`에서는 반대로 근거 요약이 유일한
                 내용이라 그대로 남는다.

                 `전제 상태 · [달라짐]` 배지 행도 여기서는 그리지 않는다 — 깨진 전제가
                 눈앞에 펼쳐져 있는데 배지가 같은 말을 한 번 더 한다. */
              <>
                <p className="text-sm text-muted-foreground">담으실 때와 달라진 게 있어요</p>
                <div className="flex flex-col gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                  {thesis.premises
                    .filter((p) => p.status === "broken")
                    .map((p) => (
                      <div key={p.id} className="flex flex-col gap-0.5">
                        <p className="text-sm font-medium">{p.statement}</p>
                        {/* 저장된 status가 출처인 전제(`fundamental`/`qualitative`,
                            ADR-0004)는 관측값이 없을 수 있다 — 없으면 문장만 세운다. */}
                        {p.observedValue ? (
                          <p className="text-xs text-destructive">지금은 {p.observedValue}</p>
                        ) : null}
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <>
                {/* 시점을 말하지 않는다. 데모에는 시계가 없어서 — `3개월 후`는 시세 변종일 뿐
                    `createdAt`은 그대로다 — 어떤 기준으로 계산해도 화면의 시제와 어긋난다(#141).
                    작성 시점을 알고 싶으면 S5가 절대 날짜로 말해준다. */}
                <p className="text-sm text-muted-foreground">이렇게 생각하셨어요</p>
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
                  ) : badge?.kind === "unknown" || badge?.kind === "unjudged" ? (
                    // 배지는 같은 "확인 불가"를 쓴다 — 사용자에게 결론은 같기 때문이다.
                    // 갈리는 것은 아래 딸린 설명이며, 원인이 다르므로 문구도 갈려야 한다(#102).
                    <Badge variant="outline">확인 불가</Badge>
                  ) : (
                    <Badge variant="secondary">유지</Badge>
                  )}
                </div>
                {badge?.kind === "unknown" ? (
                  <p className="text-xs text-muted-foreground">
                    시세를 불러오지 못해 지금은 근거가 유효한지 확인할 수 없어요.
                  </p>
                ) : badge?.kind === "unjudged" ? (
                  // 이 종목은 시세가 정상으로 도착해 있다 — 시세를 원인으로 지목하면 두 번째
                  // 거짓말이 된다. 무엇을 해야 하는지는 S5의 전제 한 줄이 말한다(#92).
                  <p className="text-xs text-muted-foreground">
                    이 근거에는 시스템이 판정할 수 없는 조건이 있어 지금은 확인할 수 없어요.
                  </p>
                ) : null}
              </>
            )}
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

        {/* 종목명은 fetch 없이 첫 프레임부터 그린다 — 무엇을 사려는지는 시세를 몰라도
            확정이고, 자리가 처음부터 잡혀야 시트 높이가 흔들리지 않는다. 현재가까지만
            두는 이유는 전제를 읽는 문맥이 거기서 끝나기 때문이다(#143). */}
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
      </div>

      <div data-slot="action-bar" className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
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
