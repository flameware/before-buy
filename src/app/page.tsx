"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { badgeLabel, badgeState, changedCount, splitByStatus, type BadgeState } from "@/lib/mock";
import { hasAutoPremise } from "@/lib/premises/engine";
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
  const state = badgeState(item);
  const quote = item.quote;

  // 시세를 기다리는 동안 자동 전제는 전부 "확인 전"이라 배지가 "유지 중"으로 계산된다 —
  // 곧 "달라짐"이 될 자리에 잘못된 확신을 보여주게 되므로 판정이 시세에 달린 종목만
  // 배지를 가린다. "근거 없음"이나 직접 확인 전제뿐인 종목은 이미 확정된 상태다.
  const badgePending =
    quote.state === "loading" && !!item.thesis && hasAutoPremise(item.thesis.premises);

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
        {badgePending ? (
          <Skeleton className="h-5 w-16 rounded-4xl" />
        ) : (
          <Badge variant={badgeVariant(state)}>{badgeLabel(state)}</Badge>
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
                (quote.snapshot.changePercent > 0
                  ? "text-red-500"
                  : quote.snapshot.changePercent < 0
                    ? "text-blue-500"
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
          size="sm"
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
      {withBuyButton ? <Skeleton className="h-8 w-14 rounded-md" /> : null}
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
  const numChanged = changedCount(watchlist);

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
            3개월 후 보기
            <Switch checked={hydrated && scenario === "future"} onCheckedChange={toggle} />
          </label>
        </div>
        {scenario === "future" ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            지금 보고 계신 가격·전제 상태는 시드 종목의 3개월 후 상황을 가정한 데모 값입니다.
          </p>
        ) : null}
        {numChanged > 0 ? (
          <Link
            href={`/stocks/${watchlist.find((i) => badgeState(i) === "changed")?.ticker ?? ""}`}
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          >
            {numChanged}개 종목에서 달라진 점이 있어요
          </Link>
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
            <Button variant="outline" className="w-full">
              + 종목 추가
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
