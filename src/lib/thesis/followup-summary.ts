// S2 후속 질문 답변을 LLM 프롬프트용 사람이 읽을 텍스트로 변환한다.
//
// 건너뛴 질문을 "자각 신호"로 명시하던 자리다. 건너뛰기가 명시적 버튼이던 시절에는
// 그 해석이 사용자의 행위에 근거했지만, 무선택이 곧 건너뜀이 된 지금(#96) "자각"은
// 프롬프트가 지어내는 말이 된다 — 안 고른 것과 못 고른 것과 안 본 것이 한 값이므로
// 관측한 사실("답하지 않음")까지만 말한다.

import { getCategory } from "@/lib/mock/categories";
import type { FollowupAnswer, ThesisCategory } from "@/lib/mock/types";

export function buildFollowupSummary(category: ThesisCategory, followup: FollowupAnswer[]): string {
  const def = getCategory(category);
  return followup
    .map((a) => {
      const question = def.questions.find((q) => q.id === a.questionId);
      const prompt = question?.prompt ?? a.questionId;
      if (a.skipped) return `${prompt}: 답하지 않음`;
      const option = question?.options.find((o) => o.value === a.selected);
      const answer = a.freeText ? (option ? `${option.label} · ${a.freeText}` : a.freeText) : (option?.label ?? "-");
      return `${prompt}: ${answer}`;
    })
    .join("\n");
}
