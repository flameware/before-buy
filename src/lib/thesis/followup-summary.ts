// S2 후속 질문 답변을 LLM 프롬프트용 사람이 읽을 텍스트로 변환한다 (지도 #38 Notes:
// "건너뛴 질문은 LLM 입력에 '건너뜀(자각 신호)'로 명시").

import { getCategory } from "@/lib/mock/categories";
import type { FollowupAnswer, ThesisCategory } from "@/lib/mock/types";

export function buildFollowupSummary(category: ThesisCategory, followup: FollowupAnswer[]): string {
  const def = getCategory(category);
  return followup
    .map((a) => {
      const question = def.questions.find((q) => q.id === a.questionId);
      const prompt = question?.prompt ?? a.questionId;
      if (a.skipped) return `${prompt}: 건너뜀(자각 신호)`;
      const option = question?.options.find((o) => o.value === a.selected);
      const answer = a.freeText ? (option ? `${option.label} · ${a.freeText}` : a.freeText) : (option?.label ?? "-");
      return `${prompt}: ${answer}`;
    })
    .join("\n");
}
