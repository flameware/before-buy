"use client";

import { useMemo, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScreenHeader } from "@/components/layout/screen-header";
import { addWithoutThesisAction } from "@/app/actions";
import { applyWatchlistAdded, WATCHLIST_LIST_KEY } from "@/lib/watchlist/cache";
import { canLeaveFollowups, toFollowupAnswers } from "@/lib/thesis/followup-answers";
import {
  CATEGORIES,
  getCategory,
  setThesisDraft,
  type FollowupAnswer,
  type FollowupQuestion,
  type ThesisCategory,
} from "@/lib/mock";

const CUSTOM_VALUE = "custom";
const FREE_TEXT_LIMIT = 200;

function optionsFor(question: FollowupQuestion) {
  const hasCustom = question.options.some((o) => o.value === CUSTOM_VALUE);
  if (question.allowsFreeText && !hasCustom && question.options.length > 0) {
    return [...question.options, { value: CUSTOM_VALUE, label: "직접 입력" }];
  }
  return question.options;
}

function QuestionCard({
  question,
  answer,
  onChange,
}: {
  question: FollowupQuestion;
  answer: FollowupAnswer | undefined;
  onChange: (next: FollowupAnswer) => void;
}) {
  const options = optionsFor(question);
  const showFreeText = options.length === 0 || answer?.selected === CUSTOM_VALUE;

  /**
   * 선택지는 토글이다 — 고른 칩을 다시 누르면 해제되고, 해제된 문항은 건너뛴 것이 된다.
   * `직접 입력`을 해제할 때 freeText도 함께 버리는 게 중요하다: 화면에서 지웠다고 믿은
   * 말이 followup에 남아 LLM 반론의 근거로 되돌아오면 안 된다 (#96).
   */
  function toggle(value: string) {
    if (answer?.selected === value) {
      onChange({ questionId: question.id });
      return;
    }
    onChange({
      questionId: question.id,
      selected: value,
      freeText: value === CUSTOM_VALUE ? answer?.freeText : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{question.prompt}</p>

      {options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={answer?.selected === option.value}
              onClick={() => toggle(option.value)}
              className={
                "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                (answer?.selected === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-input/30 text-foreground")
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {showFreeText ? (
        <Input
          value={answer?.freeText ?? ""}
          onChange={(e) =>
            onChange({
              questionId: question.id,
              selected: options.length > 0 ? CUSTOM_VALUE : undefined,
              freeText: e.target.value,
            })
          }
          placeholder="직접 입력해주세요"
        />
      ) : null}
    </div>
  );
}

export function ThesisFlow({
  ticker,
  stockName,
  alreadyWatched,
}: {
  ticker: string;
  stockName: string;
  alreadyWatched: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [skipping, startSkip] = useTransition();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<ThesisCategory | null>(null);
  const [answers, setAnswers] = useState<Record<string, FollowupAnswer>>({});
  const [freeText, setFreeText] = useState("");

  const categoryDef = category ? getCategory(category) : null;

  const step2Complete = useMemo(
    () => !!categoryDef && canLeaveFollowups(categoryDef.questions, answers),
    [categoryDef, answers]
  );

  function handleBack() {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  function handleSubmit() {
    if (!category) return;
    setThesisDraft(ticker, {
      category,
      followup: toFollowupAnswers(getCategory(category).questions, answers),
      freeText: freeText.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    router.push(`/thesis/${ticker}/result`);
  }

  /**
   * "건너뛰기": 근거 없이 담고 S1으로. 응답을 기다렸다가 이동한다 — 낙관적으로 먼저
   * 보내면 S1이 "목록을 아직 모르는" 것도 "비어 있는" 것도 아닌 세 번째 상태를
   * 떠안게 된다 (#94, CONTEXT.md "목록 상태").
   */
  function handleSkip() {
    startSkip(async () => {
      const added = await addWithoutThesisAction(ticker);
      // ADR-0010: 응답으로 온 행을 S1 캐시에 옮겨 담고, 무효화는 배경 재검증으로 남긴다 (#107).
      applyWatchlistAdded(queryClient, added);
      void queryClient.invalidateQueries({ queryKey: WATCHLIST_LIST_KEY });
      router.push(`/?highlight=${ticker}`);
    });
  }

  return (
    <>
      <ScreenHeader title={stockName} onBack={handleBack} />
      <Progress value={(step / 3) * 100} className="px-4 pt-3" />
      <p className="px-4 pt-1 text-xs text-muted-foreground">{step}/3</p>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        {step === 1 ? (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">왜 이 종목에 관심이 있으세요?</h2>
              <p className="text-sm text-muted-foreground">
                이유를 알려주시면 AI가 놓친 점은 없는지 함께 짚어드려요.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={
                    "rounded-2xl border px-4 py-3 text-sm font-medium transition-colors " +
                    (category === c.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground")
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 && categoryDef ? (
          <div className="flex flex-col gap-6">
            {categoryDef.questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                answer={answers[q.id]}
                onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
              />
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              덧붙이고 싶은 생각이 있다면 적어주세요. (건너뛰어도 됩니다)
            </p>
            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value.slice(0, FREE_TEXT_LIMIT))}
              maxLength={FREE_TEXT_LIMIT}
              rows={5}
              placeholder="예: 중국향 매출 회복 기대. 다만 경쟁사 진입 가능성은 계속 지켜볼 생각."
            />
            <p className="text-right text-xs text-muted-foreground">
              {freeText.length}/{FREE_TEXT_LIMIT}
            </p>
          </div>
        ) : null}
      </div>

      <div data-slot="action-bar" className="shrink-0 border-t border-border px-4 py-3">
        {step === 1 ? (
          <div className="flex flex-col items-center gap-3">
            {/* 이미 담긴 종목이면 렌더하지 않는다 — 근거 없이 한 번 더 담을 일이 없다. */}
            {!alreadyWatched ? (
              <button
                type="button"
                onClick={handleSkip}
                disabled={skipping}
                className="text-sm text-muted-foreground underline disabled:opacity-50"
              >
                {skipping ? "담는 중..." : "건너뛰기"}
              </button>
            ) : null}
            <Button
              size="lg"
              className="w-full"
              disabled={!category || skipping}
              onClick={() => setStep(2)}
            >
              다음
            </Button>
          </div>
        ) : null}
        {step === 2 ? (
          <Button size="lg" className="w-full" disabled={!step2Complete} onClick={() => setStep(3)}>
            다음
          </Button>
        ) : null}
        {step === 3 ? (
          <Button size="lg" className="w-full" onClick={handleSubmit}>
            이대로 담기
          </Button>
        ) : null}
      </div>
    </>
  );
}
