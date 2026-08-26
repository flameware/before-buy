"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScreenHeader } from "@/components/layout/screen-header";
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

function isAnswered(question: FollowupQuestion, answer: FollowupAnswer | undefined): boolean {
  if (!answer) return false;
  if (answer.skipped) return true;
  if (question.options.length === 0) return !!answer.freeText?.trim();
  if (answer.selected === CUSTOM_VALUE) return !!answer.freeText?.trim();
  return !!answer.selected;
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{question.prompt}</p>
        {!answer?.skipped ? (
          <button
            type="button"
            onClick={() => onChange({ questionId: question.id, skipped: true })}
            className="text-xs text-muted-foreground underline"
          >
            건너뛰기
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange({ questionId: question.id })}
            className="text-xs text-muted-foreground underline"
          >
            다시 답하기
          </button>
        )}
      </div>

      {answer?.skipped ? (
        <p className="text-xs text-muted-foreground">건너뛰었어요.</p>
      ) : (
        <>
          {options.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChange({
                      questionId: question.id,
                      selected: option.value,
                      freeText: option.value === CUSTOM_VALUE ? answer?.freeText : undefined,
                    })
                  }
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
        </>
      )}
    </div>
  );
}

export function ThesisFlow({ ticker, stockName }: { ticker: string; stockName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<ThesisCategory | null>(null);
  const [answers, setAnswers] = useState<Record<string, FollowupAnswer>>({});
  const [freeText, setFreeText] = useState("");

  const categoryDef = category ? getCategory(category) : null;

  const step2Complete = useMemo(() => {
    if (!categoryDef) return false;
    return categoryDef.questions.every((q) => isAnswered(q, answers[q.id]));
  }, [categoryDef, answers]);

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
      followup: Object.values(answers),
      freeText: freeText.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    router.push(`/thesis/${ticker}/result`);
  }

  return (
    <>
      <ScreenHeader title={stockName} onBack={handleBack} />
      <Progress value={(step / 3) * 100} className="px-4 pt-3" />
      <p className="px-4 pt-1 text-xs text-muted-foreground">{step}/3</p>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        {step === 1 ? (
          <>
            <h2 className="text-lg font-semibold">왜 이 종목에 관심이 있으세요?</h2>
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

      <div className="shrink-0 border-t border-border px-4 py-3">
        {step === 1 ? (
          <Button className="w-full" disabled={!category} onClick={() => setStep(2)}>
            다음
          </Button>
        ) : null}
        {step === 2 ? (
          <Button className="w-full" disabled={!step2Complete} onClick={() => setStep(3)}>
            다음
          </Button>
        ) : null}
        {step === 3 ? (
          <Button className="w-full" onClick={handleSubmit}>
            이대로 담기
          </Button>
        ) : null}
      </div>
    </>
  );
}
