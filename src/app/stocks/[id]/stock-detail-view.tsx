"use client";

import { useTransition, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { applyWatchlistRemoved, WATCHLIST_LIST_KEY } from "@/lib/watchlist/cache";

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
 * 가격 흐름 표의 한 행. **행이 곧 시점이다** — 담은 날 / 매수 / 오늘.
 *
 * 3열(라벨 · 날짜 · 값)로 세우는 이유는 값이 오른쪽 한 축에 꽂히게 하기 위해서다. 예전에는
 * `담은 날 172,000원 (6/18) → 현재 186,500원 +8.4%` 한 줄이었는데, 라벨·날짜·가격이 뒤섞여
 * 세로 스캔선이 없었다 — 두 값을 비교하려면 매번 문장을 읽어야 했다(#127). 날짜를 라벨에
 * 붙이지 않고 제 열에 두는 것도 같은 이유다: 라벨 길이가 달라도(`담은 날` 3자, `매수` 2자)
 * 날짜가 세로로 맞는다.
 *
 * `when`은 없을 수 있다 — `오늘` 행이 그렇다. 이유는 `PriceFlowSection`에 적어둔다.
 *
 * 행은 `<Fragment>`로 셀 셋을 흘려보낸다 — 행마다 `div`로 감싸면 그리드가 열을 못 맞춘다.
 */
function PriceFlowRow({
  label,
  when,
  children,
  emphasis = false,
}: {
  label: string;
  when?: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-muted-foreground">{when}</span>
      <span className={emphasis ? "text-right text-base font-semibold" : "text-right text-sm text-muted-foreground"}>
        {children}
      </span>
    </>
  );
}

/**
 * 점선 아래 파생 값(`담은 날 대비`·`손익`)의 오른쪽 칸.
 *
 * **시세가 없어도 행은 사라지지 않는다.** 예전에는 값이 없으면 줄을 통째로 지웠고, 시세가
 * 도착하는 순간 카드 높이가 튀었다. 조회 중이면 스켈레톤, 기준이 없으면 `-`로 자리를 지킨다 —
 * `오늘` 행 가격 칸과 같은 규율이고, CONTEXT.md `시세 상태`가 말하는 "결판나기 전에 결판난
 * 것처럼 말하지 않는다"의 같은 얼굴이다.
 *
 * `null`은 **기준 가격이 없다**는 뜻이라 `-`로 말한다 — 0%로 접으면 "안 변했다"가 된다.
 */
function DerivedValue({ pending, value }: { pending: boolean; value: number | null }) {
  if (pending) return <Skeleton className="ml-auto h-4 w-14" />;
  if (value === null) return <span className="text-right text-sm text-muted-foreground">-</span>;
  return <span className={`text-right text-sm font-medium ${changeColor(value)}`}>{formatChange(value)}</span>;
}

/**
 * S5 상단 **가격 흐름**. 담은 날 → (매수) → 오늘이라는 시간축을 표로 세우고, 점선 아래에
 * 그 값들로 계산해낸 것을 둔다.
 *
 * 점선인 이유: 근거 카드가 쓰는 실선과 **다른 종류의 경계**다. 칸막이가 아니라 "위는 관측된
 * 값, 아래는 그걸로 계산해낸 값"이라는 선이라, 같은 선을 쓰면 그냥 또 하나의 문단 구분으로
 * 읽힌다.
 *
 * 보유중의 `담은 날 대비`·`손익`을 한 줄에 나란히 두지 않는 것은 의도된 것이다 — 한 줄에
 * 넣으면 앞쪽 퍼센트가 오른쪽 정렬선 밖으로 벗어나 이 표의 이점이 깨진다. 두 행으로 세우면
 * 위에서 아래로 `담은 날 → 매수 → 오늘 → 담은 날 대비 → 손익` 순이 되어, 두 파생값이 어느
 * 행에서 왔는지가 순서만으로 드러난다. 그래서 `손익`은 `매수 대비`로 개명하지 않는다:
 * `담은 날 대비`는 생각이 아직 맞나를 재는 진단값이고 `손익`은 번 돈과 잃은 돈이라는 사실이라,
 * 이름을 맞추면 둘이 같은 종류의 퍼센트 두 개로 납작해진다.
 */
function PriceFlowSection({
  item,
  isBought,
  snapshot,
  quotePending,
  sinceAdded,
  sinceBuy,
}: {
  item: ReturnType<typeof composeView>;
  isBought: boolean;
  snapshot: { price: number } | null;
  quotePending: boolean;
  sinceAdded: number | null;
  sinceBuy: number | null;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">가격 흐름</h2>
      <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <PriceFlowRow label="담은 날" when={formatDate(item.addedAt)}>
          {formatPrice(item.addedPrice)}
        </PriceFlowRow>

        {isBought ? (
          <PriceFlowRow label="매수" when={item.boughtAt ? formatDate(item.boughtAt) : "-"}>
            {item.avgBuyPrice != null ? formatPrice(item.avgBuyPrice) : "-"}
          </PriceFlowRow>
        ) : null}

        {/* 라벨은 `오늘`이고 날짜 칸은 **비운다**. `현재 | 오늘`은 두 칸이 같은 말을 두 번 해
            이 표의 이점인 세로 스캔선 하나를 낭비했고, `현재`는 이미 데모 시점의 값 이름이다.
            날짜를 채우지 않는 이유는 **데모에 시계가 없다**는 것이다 — `3개월 후`는 시세 변종일
            뿐(`seed-data.ts`) `addedAt`은 그대로라, 그 모드의 '오늘'에 해당하는 날짜가 존재하지
            않는다. 없는 값을 지어내느니 칸을 비운다.

            `3개월 후` 모드에서도 이 행은 `오늘`이라고 말한다. 시뮬레이션은 앱 전체가 하는 것이고
            홈 헤더가 배너로 이미 선언한다 — 행마다 `3개월 후`를 붙이면 서비스 화면이 자기가
            데모라는 것을 매번 실토하는 꼴이 된다. */}
        <PriceFlowRow label="오늘" emphasis>
          {quotePending ? (
            <Skeleton className="ml-auto h-5 w-24" />
          ) : snapshot ? (
            formatPrice(snapshot.price)
          ) : (
            "시세 조회 실패"
          )}
        </PriceFlowRow>

        <div className="col-span-3 border-t border-dashed border-border" />

        <span className="text-sm text-muted-foreground">담은 날 대비</span>
        <span />
        <DerivedValue pending={quotePending} value={sinceAdded} />

        {isBought ? (
          <>
            <span className="text-sm text-muted-foreground">손익</span>
            <span />
            <DerivedValue pending={quotePending} value={sinceBuy} />
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * 전제 한 건. **카드가 아니라 행이다** — 카드는 섹션이 소유한다(CONTEXT.md `섹션 카드`, #137).
 *
 * 행끼리는 간격만으로 갈린다. 구분선을 넣지 않는 이유는 이 화면에서 선이 이미 뜻을 갖고 있기
 * 때문이다 — 근거 카드의 실선은 문단 구분, 가격 흐름의 점선은 "위는 관측값 아래는 파생값"이다.
 * 여기 실선을 하나 더 그으면 방금 걷어낸 분절이 선의 형태로 되살아난다.
 *
 * 그래서 **행 안 간격(`gap-1`)과 행 사이 간격(섹션의 `gap-5`)의 차이가 유일한 경계다.** 둘의
 * 비가 좁아지면 세 전제가 한 덩어리로 뭉개지므로, 한쪽만 손대지 않는다 (#136이 S1에서 "안쪽
 * 여백이 바깥 간격보다 크면 묶임이 뒤집힌다"고 기록한 것과 같은 규율이다).
 *
 * 깨진 전제의 강조는 붉은 문구뿐이다. 배경 틴트도 프로토타입에서 함께 봤지만, 틴트가 행을 덮으면
 * 그 행만 카드처럼 읽혀 없앤 문법이 색으로 되살아난다 — 붉은 문구는 두 줄이라 그러지 않아도
 * 묻히지 않는다.
 *
 * 배지와 그 아래 문구는 `premiseDisplay` 한 곳에서 함께 결정된다 — 여기서 갈라 보면
 * "자동 확인"과 "아직 직접 확인이 필요해요"가 한 줄에 공존하는 #88이 다시 난다.
 */
function PremiseRow({ premise, quotePending }: { premise: Premise; quotePending: boolean }) {
  const { badge, body } = premiseDisplay(premise, quotePending);
  return (
    <div className="flex flex-col gap-1">
      {/* `items-start` — 전제 문장은 두 줄로 넘어간다. 세로 중앙에 두면 배지가 둘째 줄
          높이까지 내려와, 전제마다 배지의 y가 문장 길이에 따라 달라진다. 오른쪽 배지 열의
          세로 스캔선이 그렇게 깨진다. 배지는 문장 첫 줄에 맞춰 선다. */}
      <div className="flex items-start justify-between gap-3">
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
  const [removing, startRemove] = useTransition();
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

  /**
   * "관심종목에서 제외". **응답을 기다렸다가 이동한다.** 예전에는 기다리지 않고 먼저
   * 이동해, 뺀 종목이 홈 목록에 남아 있다가 재검증이 끝나면 사라졌다 (#107).
   *
   * 기다림이 없어지는 게 아니라 자리를 옮긴 것이다 — 확인 다이얼로그를 막 지난 이 자리의
   * 대기는 "내 행동이 처리되는 중"으로 읽히지만, 홈에 돌아온 뒤의 같은 대기는 "화면이
   * 틀렸다"로 읽힌다. `건너뛰기`가 같은 이유로 같은 선택을 한다(`thesis-flow.tsx`).
   */
  function handleRemove() {
    startRemove(async () => {
      const removed = await removeWatchlistItemAction(ticker);
      // 0-row였다면 서버가 아무것도 확정하지 않은 것이다 — 캐시를 건드리지 않는다.
      if (removed) {
        applyWatchlistRemoved(queryClient, removed);
        void queryClient.invalidateQueries({ queryKey: WATCHLIST_LIST_KEY });
      }
      router.push("/");
    });
  }

  return (
    <>
      <ScreenHeader title={stockName} />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        <PriceFlowSection
          item={item}
          isBought={isBought}
          snapshot={snapshot}
          quotePending={quotePending}
          sinceAdded={sinceAdded}
          sinceBuy={sinceBuy}
        />

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
              <div className="flex flex-col gap-5 rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
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

        {/* 근거 갱신은 **두 상태 모두** body 맨 아래에 둔다 — 관심종목과 보유중이 같은
            골격을 갖게 하는 것이 이 배치의 목적이다(#105). 앰버라 body 안에서도 충분히
            눈에 띄므로 하단 바에 고정할 이유가 적고, 하단 바는 그만큼 비워 각 상태의
            고유한 행동(`관심종목에서 제외`·`판매`)에 내준다.
            근거가 없는 종목이면 라벨이 `근거 적기`가 되는데, 그때는 바로 위의 "아직 왜
            담았는지 적어두지 않았어요" 빈 카드가 이 버튼을 가리키게 된다. */}
        {/* 하단 바 버튼(48px 전체폭)과 크기를 맞추지 않는다 — 이 버튼은 body 안의 내용물이라
            같은 치수를 쓰면 바가 하나 더 있는 것처럼 읽힌다. 40px에 라벨 폭 + 좌우 패딩으로
            줄이고, 강조는 앰버가 맡는다. `default`(36px)도 `lg`(48px)도 아닌 크기라
            사이즈 토큰을 늘리는 대신 이 한 곳에서만 덮는다. */}
        <Button
          className="h-10 self-center px-5"
          onClick={handleUpdateThesis}
        >
          {updateThesisLabel}
        </Button>
      </div>

      {/* 하단 바는 두 상태가 같은 자리를 쓰되 왼쪽 칸만 갈린다 — 오른쪽은 언제나 `구매`다.
          왼쪽에 오는 것은 그 상태에서만 뜻이 있는 행동이다: 아직 안 샀으면 담아둔 것을
          치우는 일, 이미 샀으면 파는 일.

          보유중의 `판매`/`구매`는 매도를 권하는 것이 아니라, 보유한 종목의 상세에서
          양방향을 동등하게 열어두는 것이다 — 대칭을 깨는 시각 처리(판매만 약하게 그리기
          등)는 제품이 매수 쪽으로 기울었다는 신호가 되므로 하지 않는다 (ADR-0009).
          반대로 `관심종목에서 제외`는 매매가 아니라 정리 행위라 outline으로 물러선다. */}
      <div data-slot="action-bar" className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        {isBought ? (
          <Button variant="sell" size="lg" className="flex-1" onClick={handleSell}>
            판매
          </Button>
        ) : (
          <RemoveFromWatchlistButton onConfirm={handleRemove} pending={removing} />
        )}
        <Button variant="buy" size="lg" className="flex-1" onClick={handleBuy}>
          구매
        </Button>
      </div>
    </>
  );
}

/**
 * 관심종목 해제. **확인을 세우는 이유는 되돌릴 수 없기 때문이다** — `removeWatchlistItem`은
 * `status: "removed"` 소프트 삭제지만 다시 담는 경로가 그 행을 되살리지 않고 새로 심는다
 * (`add-without-thesis.ts`, `commit-thesis.ts`). 근거는 사라지고 담은 날 가격도 오늘로 새로
 * 시작한다. 버튼이 어디에 놓이든 이 사실은 그대로이고, 지금은 눈에 띄는 `구매` 바로 옆이라
 * 오탭 비용이 오히려 더 크다.
 */
function RemoveFromWatchlistButton({
  onConfirm,
  pending,
}: {
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog>
      {/* 다이얼로그는 확인과 동시에 닫히므로 대기는 이 트리거 자리에서 말한다 — 버튼이
          아무 반응 없이 그대로 있으면 "안 눌렸나"가 되고, 그 오해가 두 번 누르게 만든다. */}
      <AlertDialogTrigger
        render={<Button variant="outline" size="lg" className="flex-1" disabled={pending} />}
      >
        {pending ? "빼는 중…" : "관심종목에서 제외"}
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
