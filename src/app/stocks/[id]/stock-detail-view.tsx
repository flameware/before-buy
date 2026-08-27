"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/layout/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoScenario } from "@/hooks/use-demo-scenario";
import { useUnsupportedTradeToast } from "@/hooks/use-unsupported-trade-toast";
import { useWatchlistItemView } from "@/hooks/use-watchlist-view";
import { composeView } from "@/lib/watchlist/compose-view";
import { returnSinceAdded, returnSinceBuy } from "@/lib/watchlist/returns";
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

// 등락 방향 색. 매매 방향 색(`trade-buy`/`trade-sell`)과 값이 같아도 뜻이 다르므로
// 토큰이 갈려 있다 — 한쪽을 조정해도 다른 쪽이 끌려가지 않는다.
function changeColor(changePercent: number): string {
  if (changePercent > 0) return "text-price-up";
  if (changePercent < 0) return "text-price-down";
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
    if (a.skipped) return { prompt, answer: "답하지 않음" };
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
  const notifyUnsupportedTrade = useUnsupportedTradeToast();

  // S4와 같은 훅을 쓰되 시세는 고정하지 않는다 — S5는 결정 지점이 아니라 조회 화면이라
  // ADR-0002의 기본값(조용한 재검증)이 그대로 맞다.
  const { status, listItem, quote } = useWatchlistItemView(ticker, scenario, hydrated);

  if (status === "loading") {
    // 예전에는 여기서 헤더만 렌더해 본문이 통째로 비어 있었다.
    return (
      <>
        {/* 로딩 중에는 관심종목인지 보유중인지 아직 모른다 — 북마크를 그리지 않는다. */}
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
  // 두 기준을 여기서 계산하지 않는 이유는 `returns.ts` 머리말에 있다 (#86).
  // `null`은 **기준 가격이 없다**는 뜻이다 — 0%로 접으면 안 된다.
  const sinceAdded = snapshot ? returnSinceAdded(snapshot.price, item.addedPrice) : null;
  const sinceBuy = isBought && snapshot ? returnSinceBuy(snapshot.price, item.avgBuyPrice) : null;
  const updateThesisLabel = item.thesis ? "생각 업데이트 하기" : "근거 적기";

  function handleUpdateThesis() {
    router.push(`/thesis/${ticker}`);
  }

  function handleSell() {
    // 매도는 뒤에 시트가 없다 — S4는 매수 전제로만 짜여 있고, 매도 모드 분기는 이
    // 프로토타입의 범위 밖이다(#105). 그래서 버튼 자리에서 바로 사실을 말한다.
    notifyUnsupportedTrade("sell");
  }

  function handleBuy() {
    // S1 카드의 `구매`와 같은 경로다 — 보유중의 추가 매수도 근거를 한 번 되비추고 지나간다.
    router.push(`/order/${ticker}`);
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
      {/* 북마크는 관심종목일 때만 있다. 보유중에는 제외 경로가 애초에 없고(화면명세 S5),
          비활성 아이콘을 그려두면 "왜 안 눌리지"라는 질문만 만들고 답은 주지 않는다. */}
      <ScreenHeader
        title={stockName}
        action={isBought ? undefined : <RemoveFromWatchlistButton onConfirm={handleRemove} />}
      />
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
              {sinceAdded !== null || sinceBuy !== null ? (
                <div className="flex items-center gap-3 text-xs">
                  {sinceAdded !== null ? (
                    <span className={changeColor(sinceAdded)}>근거 대비 {formatChange(sinceAdded)}</span>
                  ) : null}
                  {sinceBuy !== null ? (
                    <span className={changeColor(sinceBuy)}>손익 {formatChange(sinceBuy)}</span>
                  ) : null}
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
              {sinceAdded !== null ? (
                <span className={`text-xs ${changeColor(sinceAdded)}`}>{formatChange(sinceAdded)}</span>
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

        {/* 보유중의 근거 갱신은 body 맨 아래에 둔다 — 하단 바는 `판매`/`구매` 대칭에
            내주고, 이 버튼은 "전제별 상태"를 다 읽은 뒤 자연스럽게 닿는 자리에 온다.
            예전에는 보유중에 하단 바 자체가 없어서, 전제 추적은 계속되는데 근거를 고칠
            길은 없었다(#105). */}
        {isBought ? (
          <Button size="lg" className="w-full" onClick={handleUpdateThesis}>
            {updateThesisLabel}
          </Button>
        ) : null}
      </div>

      {/* 하단 바는 이 화면에서 지금 하고 싶은 일만 담는다. 관심종목에서 빼는 것은 매매도
          검토도 아닌 정리 행위라 헤더 북마크로 올라갔다.

          보유중의 `판매`/`구매`는 매도를 권하는 것이 아니라, 보유한 종목의 상세에서
          양방향을 동등하게 열어두는 것이다 — 대칭을 깨는 시각 처리(판매만 약하게 그리기
          등)는 제품이 매수 쪽으로 기울었다는 신호가 되므로 하지 않는다 (ADR-0009). */}
      <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        {isBought ? (
          <Button variant="sell" size="lg" className="flex-1" onClick={handleSell}>
            판매
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={handleUpdateThesis}>
            {updateThesisLabel}
          </Button>
        )}
        <Button variant="buy" size="lg" className="flex-1" onClick={handleBuy}>
          구매
        </Button>
      </div>
    </>
  );
}

/**
 * 관심종목 해제. 토글 아이콘은 "껐다 켤 수 있다"고 약속하지만 **실제로는 되돌릴 수 없다** —
 * `removeWatchlistItem`은 `status: "removed"` 소프트 삭제인데 다시 담는 경로가 그 행을
 * 되살리지 않고 새로 심는다(`add-without-thesis.ts`, `commit-thesis.ts`). 근거는 사라지고
 * 담은 날 가격도 오늘로 새로 시작한다. 그래서 해제 방향에만 확인을 세운다.
 */
function RemoveFromWatchlistButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        aria-label="관심종목에서 빼기"
        className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
      >
        <Bookmark className="size-5 fill-current" />
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>관심종목에서 뺄까요?</AlertDialogTitle>
          {/* `break-keep` — 기본 줄바꿈은 한글을 어절 중간에서 자른다("사라져 / 요."). */}
          <AlertDialogDescription className="break-keep">
            빼면 적어두신 근거도 함께 사라져요. 다시 담아도 되돌아오지 않아요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>그대로 두기</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            빼기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
