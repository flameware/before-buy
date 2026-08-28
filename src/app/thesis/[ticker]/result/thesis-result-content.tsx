"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/layout/screen-header";
import { isAutoCheck } from "@/lib/premises/engine";
import type { Thesis } from "@/lib/mock/types";

// S3 본문. 데이터를 만드는 일(LLM 호출·담기)은 `ThesisResultView`가 하고 여기서는
// 그리기만 한다 — 유상 호출 없이 화면을 보려면 이 컴포넌트만 fixture로 렌더하면 된다.
//
// 화면은 **두 국면**이다(화면명세 S3). 국면 1 "지금 판단할 것"(반박 + 확인해볼 질문),
// 국면 2 "앞으로 볼 것"(전제). 국면 제목 둘이 대등한 `text-lg`로 서고, 그 아래 층은
// 섹션 라벨(`text-sm`), 그 아래가 행이다. 세 덩어리가 세 가지 크기·세 가지 표시법으로
// 서 있던 것이 눈에 안 들어오던 원인이었다.

/**
 * major를 위로 올린다. severity는 배지로 노출하지 않고 **정렬에만** 쓴다 —
 * "major"는 사용자에게 개념어이고(화면명세 0-1), 배지로 만들면 전제의
 * `자동 확인`/`직접 확인 필요`와 한 화면에서 네 종류 배지가 경쟁한다.
 */
function bySeverity<T extends { severity: "major" | "minor" }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(a.severity === "minor") - Number(b.severity === "minor"));
}

export function ThesisResultContent({
  stockName,
  thesis,
  onRewrite,
  onCommit,
  committing = false,
}: {
  stockName: string;
  thesis: Thesis;
  onRewrite: () => void;
  onCommit: () => void;
  committing?: boolean;
}) {
  const { critique } = thesis;
  const counterpoints = critique.isChallengeable ? bySeverity(critique.counterpoints) : [];
  const hasQuestions = critique.openQuestions.length > 0;

  return (
    <>
      <ScreenHeader title={stockName} onBack={onRewrite} />
      {/* 국면 사이(`gap-10`)는 국면 안(`gap-5`)의 두 배다 — 경계를 긋는 것은 간격뿐이고,
          구분선도 배경 틴트도 쓰지 않는다(CONTEXT.md `섹션 카드`). */}
      <div className="flex flex-1 flex-col gap-10 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {critique.isChallengeable
              ? "이런 점은 어떻게 보세요?"
              : "생각이 구체적이네요. 이것만 확인해보세요."}
          </h2>

          {/* 국면 1은 카드를 쓰지 않는다 — 국면 2의 카드가 "앞으로 남는 것"을 가리키는
              유일한 표식이 되고, 카드 경계가 없어야 반박과 질문이 한 제목 아래 같은
              덩어리로 읽힌다. 카드가 둘이던 때는 그 사이에 낀 `확인해볼 질문`이 어느
              쪽에도 속하지 않는 것처럼 보였다. */}
          <div className="flex flex-col gap-6">
            {counterpoints.length > 0 ? (
              /* 반박과 질문이 같은 불릿 문법을 쓴다. 둘을 가르는 것은 표시법이 아니라
                 사이에 놓인 라벨이다. */
              <ul className="list-disc space-y-4 pl-5">
                {counterpoints.map((cp, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium">{cp.point}</p>
                    {/* `basis`는 숫자가 들어오는 유일한 자리다. 화면에서 여기만 `text-xs`로
                        두면 글자 크기가 셋이 되므로 본문과 같은 크기로 세우고, 무게 분리는
                        크기가 아니라 색이 맡는다. */}
                    <p className="mt-1 text-sm text-muted-foreground">{cp.basis}</p>
                  </li>
                ))}
              </ul>
            ) : null}

            {hasQuestions ? (
              <div className="flex flex-col gap-3">
                {/* 반박이 있을 때만 라벨을 단다. 이 라벨은 대칭을 맞추는 장치가 아니라
                    국면 안의 전환을 알리는 장치이고, 반박이 없는 분기에서는 국면 제목이
                    곧 이 섹션의 제목이다. */}
                {counterpoints.length > 0 ? (
                  <h3 className="text-sm font-semibold">확인해볼 질문</h3>
                ) : null}
                {/* 회색은 걷는다 — 질문에 무게를 주는 것은 카드가 아니라 색이다. */}
                <ul className="list-disc space-y-3 pl-5 text-sm">
                  {critique.openQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">앞으로 이걸 지켜보면 됩니다</h2>
          {thesis.premises.length > 0 ? (
            /* 카드는 섹션이 소유하고 전제는 행이다 — S5 `전제별 상태`와 같은 골격이다
               (CONTEXT.md `섹션 카드`, #137). 담기 직후 여기서 본 목록을 나중에 S5에서 다시
               보게 되므로, 두 화면이 어긋나면 같은 전제가 화면마다 다른 모양이 된다. */
            <div className="flex flex-col gap-5 rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
              {thesis.premises.map((p) => (
                /* `items-start` — S5 `전제별 상태`와 같은 이유다. 두 줄로 넘어가는 전제
                   문장에서 배지가 문장 첫 줄에 맞춰 선다. */
                <div key={p.id} className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{p.statement}</span>
                    {p.manualNote ? (
                      <span className="text-sm text-muted-foreground">{p.manualNote}</span>
                    ) : null}
                  </div>
                  <Badge variant={isAutoCheck(p.checkType) ? "secondary" : "outline"}>
                    {isAutoCheck(p.checkType) ? "자동 확인" : "직접 확인 필요"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            /* 빈 상태는 섹션 카드가 아니다 — 여러 섹션이 공유하는 별개 문법이다. */
            <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              지켜볼 구체적인 조건이 아직 없어요. 대신 작은 금액으로 시작하는 걸 권해요.
            </p>
          )}
        </section>
      </div>

      <div data-slot="action-bar" className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onRewrite} disabled={committing}>
          다시 쓰기
        </Button>
        <Button size="lg" className="flex-1" onClick={onCommit} disabled={committing}>
          이대로 담기
        </Button>
      </div>
    </>
  );
}
