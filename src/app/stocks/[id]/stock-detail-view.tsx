"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/layout/screen-header";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { getCategory, type CheckType, type FollowupAnswer, type Premise } from "@/lib/mock";
import { getWatchlistItemDetailAction, removeWatchlistItemAction } from "@/app/actions";
import type { WatchlistViewItem } from "@/lib/watchlist/get-watchlist-item";

const priceFormat = new Intl.NumberFormat("ko-KR");

function formatPrice(price: number): string {
  return `${priceFormat.format(price)}원`;
}

function formatChange(changePercent: number): string {
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(1)}%`;
}

function changeColor(changePercent: number): string {
  if (changePercent > 0) return "text-red-500";
  if (changePercent < 0) return "text-blue-500";
  return "text-muted-foreground";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isAutoCheck(checkType: CheckType): boolean {
  return checkType === "price" || checkType === "valuation";
}

function followupSummary(category: Parameters<typeof getCategory>[0], followup: FollowupAnswer[]) {
  const def = getCategory(category);
  return followup.map((a) => {
    const question = def.questions.find((q) => q.id === a.questionId);
    const prompt = question?.prompt ?? a.questionId;
    if (a.skipped) return { prompt, answer: "건너뜀" };
    const option = question?.options.find((o) => o.value === a.selected);
    const answer = a.freeText ? (option ? `${option.label} · ${a.freeText}` : a.freeText) : (option?.label ?? "-");
    return { prompt, answer };
  });
}

function PremiseRow({ premise }: { premise: Premise }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{premise.statement}</span>
        <Badge variant={isAutoCheck(premise.checkType) ? "secondary" : "outline"}>
          {isAutoCheck(premise.checkType) ? "자동 확인" : "직접 확인 필요"}
        </Badge>
      </div>
      {premise.status === "broken" ? (
        <p className="text-xs text-destructive">
          담으실 때 보신 것과 달라진 게 있어요 — {premise.statement}, 지금은 {premise.observedValue}
        </p>
      ) : premise.status === "manual" || premise.status === "pending" ? (
        <p className="text-xs text-muted-foreground">{premise.manualNote ?? "아직 직접 확인이 필요해요."}</p>
      ) : premise.observedValue ? (
        <p className="text-xs text-muted-foreground">현재 {premise.observedValue}</p>
      ) : null}
    </div>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; item: WatchlistViewItem };

export function StockDetailView({ ticker, stockName }: { ticker: string; stockName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isFuture, hydrated } = useDemoScenario();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!hydrated || loadingRef.current) return;
    loadingRef.current = true;
    getWatchlistItemDetailAction(ticker, isFuture).then((item) => {
      setState(item ? { status: "ready", item } : { status: "not-found" });
    });
  }, [ticker, isFuture, hydrated]);

  if (!hydrated || state.status === "loading") {
    return <ScreenHeader title={stockName} />;
  }

  if (state.status === "not-found") {
    return (
      <>
        <ScreenHeader title={stockName} />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          관심종목에서 찾을 수 없어요.
        </div>
      </>
    );
  }

  const { item } = state;
  const quote = item.quote;
  const isBought = item.status === "bought";
  const returnSinceAdded = quote?.changePercent ?? 0;
  const returnSinceBuy =
    isBought && item.avgBuyPrice && quote ? ((quote.price - item.avgBuyPrice) / item.avgBuyPrice) * 100 : 0;

  function handleUpdateThesis() {
    router.push(`/thesis/${ticker}`);
  }

  function handleRemove() {
    void removeWatchlistItemAction(ticker).then(() =>
      // ADR-0002: 종목이 빠졌으니 S1 목록 캐시를 무효화해 복귀 시 바로 반영되게 한다.
      queryClient.invalidateQueries({ queryKey: ["watchlist", "list"] })
    );
    router.push("/");
  }

  return (
    <>
      <ScreenHeader title={stockName} />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
          {isBought ? (
            <>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  담은 날 {formatPrice(item.addedPrice)} ({formatDate(item.addedAt)})
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="text-muted-foreground">
                  매수 {formatPrice(item.avgBuyPrice ?? 0)} ({item.boughtAt ? formatDate(item.boughtAt) : "-"})
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">
                  현재 {quote ? formatPrice(quote.price) : "시세 조회 실패"}
                </span>
              </div>
              {quote ? (
                <div className="flex items-center gap-3 text-xs">
                  <span className={changeColor(returnSinceAdded)}>근거 대비 {formatChange(returnSinceAdded)}</span>
                  <span className={changeColor(returnSinceBuy)}>손익 {formatChange(returnSinceBuy)}</span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                담은 날 {formatPrice(item.addedPrice)} ({formatDate(item.addedAt)})
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">
                현재 {quote ? formatPrice(quote.price) : "시세 조회 실패"}
              </span>
              {quote ? (
                <span className={`text-xs ${changeColor(returnSinceAdded)}`}>{formatChange(returnSinceAdded)}</span>
              ) : null}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">내가 쓴 근거</h2>
          {item.thesis ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{getCategory(item.thesis.category).label}</span>
                <span className="text-xs text-muted-foreground">{formatDate(item.thesis.createdAt)} 작성</span>
              </div>
              <dl className="flex flex-col gap-1">
                {followupSummary(item.thesis.category, item.thesis.followup).map((f, i) => (
                  <div key={i} className="flex justify-between gap-3 text-xs">
                    <dt className="text-muted-foreground">{f.prompt}</dt>
                    <dd className="text-right">{f.answer}</dd>
                  </div>
                ))}
              </dl>
              {item.thesis.freeText ? (
                <p className="border-t border-border pt-2 text-sm">{item.thesis.freeText}</p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              아직 왜 담았는지 적어두지 않았어요.
            </p>
          )}
        </section>

        {item.thesis ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">전제별 상태</h2>
            {item.thesis.premises.length > 0 ? (
              <div className="flex flex-col gap-2">
                {item.thesis.premises.map((p) => (
                  <PremiseRow key={p.id} premise={p} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                지켜볼 구체적인 조건이 아직 없어요.
              </p>
            )}
          </section>
        ) : null}
      </div>

      {!isBought ? (
        <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" className="flex-1" onClick={handleRemove}>
            관심종목에서 제외
          </Button>
          <Button className="flex-1" onClick={handleUpdateThesis}>
            {item.thesis ? "생각 업데이트 하기" : "근거 적기"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
