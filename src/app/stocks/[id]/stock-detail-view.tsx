"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/layout/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { useWatchlistItemView } from "@/hooks/use-watchlist-view";
import { composeView } from "@/lib/watchlist/compose-view";
import { premiseDisplay } from "@/lib/premises/display";
import { getCategory, type FollowupAnswer, type Premise } from "@/lib/mock";
import { removeWatchlistItemAction } from "@/app/actions";

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

/**
 * 배지와 그 아래 문구는 `premiseDisplay` 한 곳에서 함께 결정된다 — 여기서 갈라 보면
 * "자동 확인"과 "아직 직접 확인이 필요해요"가 한 줄에 공존하는 #88이 다시 난다.
 */
function PremiseRow({ premise, quotePending }: { premise: Premise; quotePending: boolean }) {
  const { badge, body } = premiseDisplay(premise, quotePending);
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{premise.statement}</span>
        <Badge variant={badge === "auto" ? "secondary" : "outline"}>
          {badge === "auto" ? "자동 확인" : "직접 확인 필요"}
        </Badge>
      </div>
      {body.kind === "waiting" ? (
        <Skeleton className="h-4 w-2/3" />
      ) : body.kind === "alert" ? (
        <p className="text-xs text-destructive">{body.text}</p>
      ) : body.kind === "note" ? (
        <p className="text-xs text-muted-foreground">{body.text}</p>
      ) : null}
    </div>
  );
}

export function StockDetailView({ ticker, stockName }: { ticker: string; stockName: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scenario, hydrated } = useDemoScenario();

  // S4와 같은 훅을 쓰되 시세는 고정하지 않는다 — S5는 결정 지점이 아니라 조회 화면이라
  // ADR-0002의 기본값(조용한 재검증)이 그대로 맞다.
  const { status, listItem, quote } = useWatchlistItemView(ticker, scenario, hydrated);

  if (status === "loading") {
    // 예전에는 여기서 헤더만 렌더해 본문이 통째로 비어 있었다.
    return (
      <>
        <ScreenHeader title={stockName} />
        <div className="flex flex-1 flex-col gap-6 px-4 py-4">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </>
    );
  }

  if (status === "not-found" || !listItem) {
    return (
      <>
        <ScreenHeader title={stockName} />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          관심종목에서 찾을 수 없어요.
        </div>
      </>
    );
  }

  const item = composeView(listItem, quote);
  const isBought = item.status === "bought";
  const snapshot = quote.state === "ok" ? quote.snapshot : null;
  // 조회 중에는 가격도 전제 상태도 확정되지 않았다 — 실패 문구 대신 자리를 비워 기다린다.
  const quotePending = quote.state === "loading";
  const returnSinceAdded = snapshot?.changePercent ?? 0;
  const returnSinceBuy =
    isBought && item.avgBuyPrice && snapshot
      ? ((snapshot.price - item.avgBuyPrice) / item.avgBuyPrice) * 100
      : 0;

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
                  현재{" "}
                  {quotePending ? (
                    <Skeleton className="inline-block h-4 w-20 align-middle" />
                  ) : snapshot ? (
                    formatPrice(snapshot.price)
                  ) : (
                    "시세 조회 실패"
                  )}
                </span>
              </div>
              {snapshot ? (
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
                현재{" "}
                {quotePending ? (
                  <Skeleton className="inline-block h-4 w-20 align-middle" />
                ) : snapshot ? (
                  formatPrice(snapshot.price)
                ) : (
                  "시세 조회 실패"
                )}
              </span>
              {snapshot ? (
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
                  <PremiseRow key={p.id} premise={p} quotePending={quotePending} />
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
