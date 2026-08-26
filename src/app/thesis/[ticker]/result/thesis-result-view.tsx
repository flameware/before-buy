"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/layout/screen-header";
import { commitThesisAction, generateThesisResultAction, getExistingThesisAction } from "@/app/actions";
import { getThesisDraft } from "@/lib/mock";
import type { CheckType, QuoteSnapshot, Thesis } from "@/lib/mock/types";
import type { CritiqueOutput } from "@/lib/llm/types";
import type { GenerateThesisResultOutcome } from "@/lib/thesis/generate-result";

function isAutoCheck(checkType: CheckType): boolean {
  return checkType === "price" || checkType === "valuation";
}

function critiqueOutputToThesis(
  category: Thesis["category"],
  followup: Thesis["followup"],
  freeText: string | undefined,
  createdAt: string,
  critique: CritiqueOutput
): Thesis {
  return {
    category,
    followup,
    freeText,
    createdAt,
    critique: {
      isChallengeable: critique.isChallengeable,
      challengeReason: critique.challengeReason,
      counterpoints: critique.counterpoints,
      openQuestions: critique.openQuestions,
    },
    premises: critique.premises.map((p, i) => ({
      id: `pending-${i}`,
      statement: p.statement,
      checkType: p.checkType,
      status: isAutoCheck(p.checkType) ? "pending" : "manual",
    })),
  };
}

type LoadState =
  | { status: "loading" }
  | { status: "no-draft" }
  | { status: "error"; reason: "quote-unavailable" | "llm-call-limit-exceeded" | "llm-error" }
  | { status: "ready-existing"; thesis: Thesis }
  | { status: "ready-new"; thesis: Thesis; quote: QuoteSnapshot; critique: CritiqueOutput };

export function ThesisResultView({ ticker, stockName }: { ticker: string; stockName: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [committing, setCommitting] = useState(false);
  const generatingRef = useRef(false);

  async function load() {
    try {
      // 이 draft 조회는 브라우저 전용 인메모리 스토어를 읽는다 — 서버 렌더 시점엔
      // 항상 비어 있으므로, 하이드레이션 불일치를 피하려고 마운트 후에만 반영한다.
      const draft = getThesisDraft(ticker);
      if (!draft) {
        const thesis = await getExistingThesisAction(ticker);
        setState(thesis ? { status: "ready-existing", thesis } : { status: "no-draft" });
        return;
      }

      const outcome: GenerateThesisResultOutcome = await generateThesisResultAction(ticker, {
        category: draft.category,
        followup: draft.followup,
        freeText: draft.freeText,
      });

      if (!outcome.ok) {
        setState({ status: "error", reason: outcome.reason });
        return;
      }

      setState({
        status: "ready-new",
        thesis: critiqueOutputToThesis(draft.category, draft.followup, draft.freeText, draft.createdAt, outcome.critique),
        quote: outcome.quote,
        critique: outcome.critique,
      });
    } catch {
      // Server Action이 예상 못한 예외로 실패해도(네트워크 끊김 등) 화면이 로딩
      // 상태로 영영 멈추지 않도록 항상 에러 상태로 떨어뜨린다.
      setState({ status: "error", reason: "llm-error" });
    }
  }

  useEffect(() => {
    // Server Action은 세션당 20회 상한이 있는 유상 LLM 호출을 태울 수 있으므로,
    // React Strict Mode의 effect 이중 실행으로 같은 종목에 두 번 과금되지 않도록 막는다.
    if (generatingRef.current) return;
    generatingRef.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  if (state.status === "loading") return null;

  if (state.status === "no-draft") {
    return (
      <>
        <ScreenHeader title={stockName} />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          작성한 근거를 찾을 수 없어요. 다시 담아주세요.
        </div>
      </>
    );
  }

  if (state.status === "error") {
    const message =
      state.reason === "quote-unavailable"
        ? "시세를 불러오지 못했어요."
        : state.reason === "llm-error"
          ? "AI 검증 중 문제가 생겼어요."
          : "이 세션에서 AI 검증을 더 이상 요청할 수 없어요.";
    const canRetry = state.reason === "quote-unavailable" || state.reason === "llm-error";
    return (
      <>
        <ScreenHeader title={stockName} onBack={() => router.push(`/thesis/${ticker}`)} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-sm text-muted-foreground">
          <p>{message}</p>
          {canRetry ? (
            <Button
              onClick={() => {
                setState({ status: "loading" });
                load();
              }}
            >
              다시 시도
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  const { thesis } = state;
  const { critique } = thesis;

  function handleRewrite() {
    router.push(`/thesis/${ticker}`);
  }

  async function handleCommit() {
    if (state.status !== "ready-new") {
      router.push(`/?highlight=${ticker}`);
      return;
    }
    setCommitting(true);
    await commitThesisAction(
      ticker,
      { category: thesis.category, followup: thesis.followup, freeText: thesis.freeText },
      state.critique,
      state.quote
    );
    router.push(`/?highlight=${ticker}`);
  }

  return (
    <>
      <ScreenHeader title={stockName} onBack={handleRewrite} />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {critique.isChallengeable
              ? "이런 점은 어떻게 보세요?"
              : "생각이 구체적이네요. 대신 이건 지켜볼 만합니다."}
          </h2>

          {critique.isChallengeable ? (
            <div className="flex flex-col gap-2">
              {critique.counterpoints.map((cp, i) => (
                <div key={i} className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                  <p className="text-sm font-medium">{cp.point}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{cp.basis}</p>
                </div>
              ))}
            </div>
          ) : null}

          {critique.openQuestions.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-muted-foreground">확인해볼 질문</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {critique.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">앞으로 이걸 지켜보면 됩니다</h2>
          {thesis.premises.length > 0 ? (
            <div className="flex flex-col gap-2">
              {thesis.premises.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{p.statement}</span>
                    {p.manualNote ? (
                      <span className="text-xs text-muted-foreground">{p.manualNote}</span>
                    ) : null}
                  </div>
                  <Badge variant={isAutoCheck(p.checkType) ? "secondary" : "outline"}>
                    {isAutoCheck(p.checkType) ? "자동 확인" : "직접 확인 필요"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
              지켜볼 구체적인 조건이 아직 없어요. 대신 작은 금액으로 시작하는 걸 권해요.
            </p>
          )}
        </section>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" className="flex-1" onClick={handleRewrite} disabled={committing}>
          다시 쓰기
        </Button>
        <Button className="flex-1" onClick={handleCommit} disabled={committing}>
          이대로 담기
        </Button>
      </div>
    </>
  );
}
