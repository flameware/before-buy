"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { splitByStatus, type BadgeState } from "@/lib/mock";
import { badgeDisplay, badgeLabel, countByJudgment } from "@/lib/premises/badge";
import { useChangeSummaryToast } from "@/hooks/use-change-summary-toast";
import { useWatchlistView } from "@/hooks/use-watchlist-view";
import type { WatchlistViewItem } from "@/lib/watchlist/get-watchlist";

const priceFormat = new Intl.NumberFormat("ko-KR");

function formatPrice(price: number): string {
  return `${priceFormat.format(price)}원`;
}

function formatChange(changePercent: number): string {
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(1)}%`;
}

function badgeVariant(state: BadgeState): "outline" | "secondary" | "destructive" {
  switch (state) {
    case "no-thesis":
      return "outline";
    case "intact":
      return "secondary";
    case "changed":
      return "destructive";
  }
}

function HighlightParam({ onHighlight }: { onHighlight: (ticker: string | null) => void }) {
  const searchParams = useSearchParams();
  const ticker = searchParams.get("highlight");
  useEffect(() => {
    onHighlight(ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);
  return null;
}

function StockCard({
  item,
  highlighted,
}: {
  item: WatchlistViewItem;
  highlighted?: boolean;
}) {
  const router = useRouter();
  const quote = item.quote;

  // 배지를 그릴 수 있는지(조회 중·조회 실패면 판정 불가)는 `badgeDisplay`가 정한다 —
  // 이 조건을 카드가 인라인으로 들고 있다가 실패 축을 빠뜨린 것이 #81이었다.
  const badge = badgeDisplay(item, quote);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/stocks/${item.ticker}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(`/stocks/${item.ticker}`);
      }}
      className={
        "flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 transition-shadow " +
        (highlighted ? "ring-2 ring-primary" : "ring-foreground/10")
      }
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{item.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{item.ticker}</span>
        </div>
        {badge.kind === "badge" ? (
          <Badge variant={badgeVariant(badge.state)}>{badgeLabel(badge.state)}</Badge>
        ) : badge.kind === "pending" ? (
          <Skeleton className="h-5 w-16 rounded-4xl" />
        ) : badge.kind === "unjudged" ? (
          // 판정된 적 없음 — 배지 자리를 비우되 **이 자리가** 사정을 말한다. 시세는 정상이라
          // 오른쪽에는 평범한 현재가가 떠 있고, 그래서 "시세 조회 실패"를 빌려 쓸 수 없다(#102).
          <div className="flex h-5 items-center">
            <span className="truncate text-xs text-muted-foreground">
              시스템이 확인할 수 없는 근거가 있어요
            </span>
          </div>
        ) : (
          // 판정 불가 — 배지 자리를 비운다. 오른쪽의 "시세 조회 실패"가 그 사정을 말한다.
          // 자리는 그대로 두어(높이 유지) 카드가 목록 안에서 혼자 짧아지지 않게 한다.
          <div className="h-5" aria-hidden />
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {quote.state === "ok" ? (
          <>
            <span className="text-sm font-medium tabular-nums">
              {formatPrice(quote.snapshot.price)}
            </span>
            <span
              className={
                "text-xs tabular-nums " +
                // 등락 방향 색은 매매 방향 색(`trade-buy`/`trade-sell`)과 값이 같아도
                // 뜻이 다르다 — 토큰이 갈려 있어야 한쪽 조정이 다른 쪽을 끌고 가지 않는다.
                (quote.snapshot.changePercent > 0
                  ? "text-price-up"
                  : quote.snapshot.changePercent < 0
                    ? "text-price-down"
                    : "text-muted-foreground")
              }
            >
              {formatChange(quote.snapshot.changePercent)}
            </span>
          </>
        ) : quote.state === "loading" ? (
          // 조회 중과 조회 실패는 다르다 — 아직 시도가 끝나지 않았는데 실패를 알리지 않는다.
          <>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-10" />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">시세 조회 실패</span>
        )}
      </div>
      {item.status === "watching" ? (
        <Button
          variant="buy"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/order/${item.ticker}`);
          }}
        >
          구매
        </Button>
      ) : null}
    </div>
  );
}

/**
 * 로딩 중 카드 자리. 실제 `StockCard`와 같은 컨테이너·같은 요소 배치를 써서 로드 전후의
 * 높이가 어긋나지 않게 한다. 구매 버튼은 관심종목 섹션에만 있으므로 여기서도 갈린다.
 */
function StockCardSkeleton({ withBuyButton }: { withBuyButton: boolean }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-16 rounded-4xl" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-10" />
      </div>
      {withBuyButton ? <Skeleton className="h-9 w-14 rounded-md" /> : null}
    </div>
  );
}

// 관심종목 3장, 보유중 2장. 보유중을 스켈레톤으로 약속해도 되는 이유는 이 데모에서
// 보유중이 항상 정확히 2건이기 때문이다 — 시드가 `bought` 2건을 넣고(`seed-data.ts`),
// 보유중에는 제거 경로가 없다(S5의 "관심종목에서 제외"는 `!isBought`일 때만 뜬다).
const WATCHING_SKELETON_COUNT = 3;
const BOUGHT_SKELETON_COUNT = 2;

function SkeletonList({ count, withBuyButton }: { count: number; withBuyButton: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <StockCardSkeleton key={i} withBuyButton={withBuyButton} />
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { scenario, toggle, hydrated } = useDemoScenario();
  const [highlightTicker, setHighlightTicker] = useState<string | null>(null);

  // 목록+시세 합성과 ADR-0004의 불변식은 useWatchlistView 안에 있다 — S4/S5도 같은
  // 훅을 쓰므로 이 조합이 화면마다 복제되지 않는다.
  const { items: watchlist, isLoading: loading } = useWatchlistView(scenario, hydrated);

  const { watching, bought } = splitByStatus(watchlist);
  // 달라짐과 두 갈래의 판정 불가를 한 번에 센다 — 변동 요약 토스트는 판정된 것만 세고,
  // 판정하지 못한 종목은 헤더의 정적 줄이 따로 말한다. 예전에는 후자가 "유지 중"으로 접혀
  // 요약 자체가 조용히 사라졌다(#81, #102).
  const {
    changed: numChanged,
    unknown: numUnknown,
    unjudged: numUnjudged,
  } = countByJudgment(watchlist);
  useChangeSummaryToast(numChanged);

  useEffect(() => {
    if (!highlightTicker) return;
    const timer = setTimeout(() => {
      setHighlightTicker(null);
      router.replace("/", { scroll: false });
    }, 2500);
    return () => clearTimeout(timer);
  }, [highlightTicker, router]);

  return (
    <>
      <Suspense fallback={null}>
        <HighlightParam onHighlight={setHighlightTicker} />
      </Suspense>
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">관심종목</h1>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {/* 이 뱃지가 가리키는 것은 값이 아니라 **토글이라는 장치 자체**라 On/Off와 무관하게
                상시 노출한다 — 오해는 Off 상태에서 라벨만 보일 때 생긴다(#103). */}
            <Badge variant="default">데모용</Badge>
            3개월 후 보기
            <Switch checked={hydrated && scenario === "future"} onCheckedChange={toggle} />
          </label>
        </div>
        {scenario === "future" ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            서비스 컨셉 데모를 위해 3개월 후 상황을 가정한 값을 보여드립니다
          </p>
        ) : null}
        {/* 달라짐 요약은 헤더에 상주하지 않고 토스트로 지나간다(#103, useChangeSummaryToast).
            반면 아래 "시세를 불러오지 못해"는 사건이 아니라 풀리기 전까지 계속 참인 상태라
            정적 텍스트로 남는다 — 사라지면 "왜 이 카드엔 배지가 없지"에 답할 문장이 없어진다. */}
        {numUnknown > 0 ? (
          <p className="text-xs text-muted-foreground">
            {numUnknown}개 종목은 시세를 불러오지 못해 확인할 수 없어요
          </p>
        ) : null}
        {/* 시세 문장과 **나란히 서는 별도 문장**이다 — 합산하면 한 문장이 두 원인을 뭉뚱그려
            둘 중 한쪽 종목에는 반드시 거짓이 된다(#102). 두 축이 동시에 있으면 둘 다 뜬다. */}
        {numUnjudged > 0 ? (
          <p className="text-xs text-muted-foreground">
            {numUnjudged}개 종목은 시스템이 확인할 수 없는 근거가 있어요
          </p>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">관심종목</h2>
          {loading ? (
            <SkeletonList count={WATCHING_SKELETON_COUNT} withBuyButton />
          ) : watching.length > 0 ? (
            <div className="flex flex-col gap-2">
              {watching.map((item) => (
                <StockCard
                  key={item.id}
                  item={item}
                  highlighted={item.ticker === highlightTicker}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              관심 가는 종목을 담아보세요. 왜 담았는지 같이 적어두면 나중에 도움이 됩니다.
            </p>
          )}
          <Link href="/search">
            {/* `+`는 문자가 아니라 아이콘이다. 규격을 S4 수량 조절 버튼과 맞춰
                (`order-confirm-content.tsx`) 앱 안에서 `+`가 한 가지 모양이 되게 한다. */}
            <Button variant="outline" size="lg" className="w-full">
              <Plus className="size-4" />
              종목 추가
            </Button>
          </Link>
        </section>

        {loading || bought.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">보유중</h2>
            {loading ? (
              <SkeletonList count={BOUGHT_SKELETON_COUNT} withBuyButton={false} />
            ) : (
              <div className="flex flex-col gap-2">
                {bought.map((item) => (
                  <StockCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
