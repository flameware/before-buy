"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ScreenHeader,
  ScreenHeaderRow,
  ScreenHeaderShell,
} from "@/components/layout/screen-header";
import { ThesisResultContent } from "./thesis-result-content";
import { commitThesisAction, generateThesisResultAction, getExistingThesisAction } from "@/app/actions";
import { applyWatchlistAdded, WATCHLIST_LIST_KEY } from "@/lib/watchlist/cache";
import { clearThesisDraft, getThesisDraft, resolveThesisResultOnce } from "@/lib/mock";
import { isAutoCheck } from "@/lib/premises/engine";
import type { QuoteSnapshot, Thesis } from "@/lib/mock/types";
import type { CritiqueOutput } from "@/lib/llm/types";
import type { GenerateThesisResultOutcome } from "@/lib/thesis/generate-result";

const LOADING_STAGE_MESSAGES = [
  "종목을 분석하고 있어요",
  "반박 근거를 찾는 중이에요",
  "거의 다 됐어요, 조금만 더...",
] as const;

// 실제 LLM 진행 단계(시세 조회 → 호출 → 검증 재시도)는 프론트에서 알 수 없으므로,
// 체감 대기시간을 줄이려고 경과 시간 기준으로만 문구를 바꾼다 — 실제 단계와는 무관하다.
function useLoadingStageMessage(active: boolean): string {
  const [stage, setStage] = useState(0);
  const [prevActive, setPrevActive] = useState(active);

  // active가 다시 켜질 때(= `다시 시도`) 문구를 처음부터 돌린다.
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) setStage(0);
  }

  useEffect(() => {
    if (!active) return;
    const timers = [
      setTimeout(() => setStage(1), 7000),
      setTimeout(() => setStage(2), 18000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return LOADING_STAGE_MESSAGES[stage];
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
  const queryClient = useQueryClient();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [committing, setCommitting] = useState(false);
  const loadingMessage = useLoadingStageMessage(state.status === "loading");

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

      // 유상 호출은 draft의 결과 자리를 통과해서만 나간다 — 재진입은 앞서 본 결과를
      // (시세까지 그 시점 값 그대로) 되보여주고, 로딩 중 재진입은 먼저 뜬 호출을
      // 기다린다 (#122).
      const outcome: GenerateThesisResultOutcome = await resolveThesisResultOnce(ticker, () =>
        generateThesisResultAction(ticker, {
          category: draft.category,
          followup: draft.followup,
          freeText: draft.freeText,
        })
      );

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
    // 이중 호출 가드는 `load()` 안의 결과 자리가 맡는다 — 컴포넌트 `ref`는 언마운트되면
    // 리셋돼 Strict Mode의 effect 이중 실행만 막았고, 재진입은 그대로 통과했다 (#122).
    // `load()`는 첫 `await` 전에 `setState`에 닿지 않는다 — 규칙이 async 경계 너머를
    // 보지 못해 동기 호출로 읽을 뿐이다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  if (state.status === "loading") {
    return (
      <>
        {/* 유상 LLM 호출이 도는 중이라 뒤로가기를 두지 않는다 — `ScreenHeader`는 버튼을 항상
            렌더하므로 셸을 직접 쓴다. 세로 자리는 `ScreenHeaderRow`가 보증하고, `pl-8`은
            로딩이 끝나 `ScreenHeader`로 바뀔 때 종목명이 가로로 뛰지 않게 잡아둔다. */}
        <ScreenHeaderShell>
          <ScreenHeaderRow className="pl-8">
            <h1 className="text-base font-semibold">{stockName}</h1>
          </ScreenHeaderRow>
        </ScreenHeaderShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            {/* 헤더 밖에서 이 화면을 대표하는 문구라 본문(`text-sm`)보다 한 단계 위인
                `text-base`로 둔다 — 결과 제목(`text-lg`)보다는 한 단계 아래다. */}
            <p className="text-base font-medium">{loadingMessage}</p>
            <p className="text-sm text-muted-foreground">최대 30초 정도 걸릴 수 있어요</p>
          </div>
        </div>
      </>
    );
  }

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

  function handleRewrite() {
    router.push(`/thesis/${ticker}`);
  }

  async function handleCommit() {
    if (state.status !== "ready-new") {
      router.push(`/?highlight=${ticker}`);
      return;
    }
    setCommitting(true);
    const added = await commitThesisAction(
      ticker,
      { category: thesis.category, followup: thesis.followup, freeText: thesis.freeText },
      state.critique,
      state.quote
    );
    // ADR-0010: 서버가 돌려준 행을 S1 캐시에 옮겨 담는다 — 무효화만 하면 S1이 언마운트
    // 상태라 refetch가 시작되지 않아, 홈에 도착한 뒤에야 두 번의 왕복이 시작됐다 (#107).
    // 커밋에 성공했으므로 draft와 결과를 버린다 — 다시 담을 것이 없다. S1에서 뒤로 온
    // S3는 이제 `getExistingThesisAction` fallback으로 떨어져 커밋된 근거를 공짜로 읽고,
    // `이대로 담기`가 같은 근거를 한 겹 더 쌓는 일도 함께 막힌다 (#122).
    clearThesisDraft(ticker);
    applyWatchlistAdded(queryClient, added);
    // 무효화는 남기되 배경 재검증으로 강등한다. 옮겨 담은 값이 조회 결과와 어긋나더라도
    // (드리프트) 다음 마운트에서 조용히 교정된다.
    void queryClient.invalidateQueries({ queryKey: WATCHLIST_LIST_KEY });
    router.push(`/?highlight=${ticker}`);
  }

  return (
    <ThesisResultContent
      stockName={stockName}
      thesis={thesis}
      onRewrite={handleRewrite}
      onCommit={handleCommit}
      committing={committing}
    />
  );
}
