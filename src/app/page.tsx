"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { badgeLabel, badgeState, changedCount, splitByStatus, type BadgeState } from "@/lib/mock";
import { resolvePremises } from "@/lib/premises/engine";
import { loadWatchlistList, loadWatchlistQuotes } from "./actions";
import type { WatchlistViewItem } from "@/lib/watchlist/get-watchlist";

/** ADR-0002: 목록은 60초, 시세는 20초 — 재방문 시 캐시가 신선하면 즉시 렌더하고 조용히 갱신한다. */
const LIST_STALE_TIME_MS = 60_000;
const QUOTES_STALE_TIME_MS = 20_000;

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
        <Badge variant={badgeVariant(state)}>{badgeLabel(state)}</Badge>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {quote ? (
          <>
            <span className="text-sm font-medium tabular-nums">{formatPrice(quote.price)}</span>
            <span
              className={
                "text-xs tabular-nums " +
                (quote.changePercent > 0
                  ? "text-red-500"
                  : quote.changePercent < 0
                    ? "text-blue-500"
                    : "text-muted-foreground")
              }
            >
              {formatChange(quote.changePercent)}
            </span>
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

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scenario, toggle, hydrated } = useDemoScenario();
  const [highlightTicker, setHighlightTicker] = useState<string | null>(null);

  // ADR-0004: 목록은 데모 시점과 무관한 DB 사실(종목/근거/기준값)만 담는다. 토글해도
  // 이 쿼리는 다시 돌 필요가 없다 — 시점에 반응해야 하는 것은 아래 시세 쿼리뿐이다.
  const listQuery = useQuery({
    queryKey: ["watchlist", "list"],
    queryFn: () => loadWatchlistList(),
    enabled: hydrated,
    staleTime: LIST_STALE_TIME_MS,
  });

  const listItems = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const quoteTargets = useMemo(
    () => listItems.map((item) => ({ ticker: item.ticker, isSeed: item.isSeed })),
    [listItems]
  );
  const tickerKey = quoteTargets
    .map((t) => t.ticker)
    .sort()
    .join(",");

  const quotesQuery = useQuery({
    queryKey: ["watchlist", "quotes", tickerKey],
    queryFn: () => loadWatchlistQuotes(quoteTargets, scenario),
    enabled: hydrated && quoteTargets.length > 0,
    staleTime: QUOTES_STALE_TIME_MS,
  });

  // ADR-0004: 데모 시점은 캐시 키가 아니라 명시적 무효화로 다룬다. 시점이 바뀐 뒤의
  // 렌더에서 무효화해야 queryFn이 새 시점을 닫아 잡는다 — 토글 핸들러 안에서 부르면
  // 직전 시점으로 재조회될 수 있다.
  useEffect(() => {
    if (!hydrated) return;
    void queryClient.invalidateQueries({ queryKey: ["watchlist", "quotes"] });
  }, [scenario, hydrated, queryClient]);

  // 배지는 화면에 그리는 바로 그 시세에서 나온다. 가격만 미래로 바뀌고 배지가 과거에
  // 남는 일이 구조적으로 불가능해진다(ADR-0004).
  const watchlist: WatchlistViewItem[] = useMemo(
    () =>
      listItems.map((item) => {
        const quote = quotesQuery.data?.[item.ticker] ?? null;
        return {
          ...item,
          quote,
          thesis: item.thesis
            ? { ...item.thesis, premises: resolvePremises(item.thesis.premises, quote) }
            : undefined,
        };
      }),
    [listItems, quotesQuery.data]
  );

  const loading = listQuery.isLoading;
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
            <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              불러오는 중...
            </p>
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

        {bought.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">보유중</h2>
            <div className="flex flex-col gap-2">
              {bought.map((item) => (
                <StockCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
