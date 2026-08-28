// S2 후속 질문 답변을 LLM 프롬프트용 사람이 읽을 텍스트로 변환한다.
// 답 자리의 네 갈래는 `프롬프트 명세.md` 3장에 적혀 있다.
//
// 건너뛴 질문을 "자각 신호"로 명시하던 자리다. 건너뛰기가 명시적 버튼이던 시절에는
// 그 해석이 사용자의 행위에 근거했지만, 무선택이 곧 건너뜀이 된 지금(#96) "자각"은
// 프롬프트가 지어내는 말이 된다 — 안 고른 것과 못 고른 것과 안 본 것이 한 값이므로
// 관측한 사실("답하지 않음")까지만 말한다.
//
// **같은 답 조립식이 S5 상세(`stock-detail-view.tsx`)에도 한 벌 더 있다. 지금 둘이 같은 것은
// 우연이지 계약이 아니다** — 이쪽은 모델에게 가는 계약이고 저쪽은 사람이 읽는 표시다. 청중이
// 다르니 갈릴 이유도 있다(화면은 빈 답을 더 친절한 말로 바꾸고 싶어질 수 있고, 프롬프트는
// 그러면 안 된다). DRY로 읽고 하나로 모으지 말 것 — 아래 폴백처럼 살아 있는 가지마저 다르다 (#159).

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
      // `-` 폴백은 **이 경로에서 도달하지 않는다.** 이 함수는 S2가 방금 만든 초안에만 불리고
      // (`generate-result.ts`), 그 초안의 `selected`는 방금 그린 선택지에서 온 값이라 항상
      // 맞는다. 저장된 옛 근거를 다시 프롬프트에 넣는 길은 없다 — S2는 빈 화면에서 시작한다(#154).
      // 화면 사본 쪽은 옛 근거를 그리므로 거기서는 살아 있다. 그래서 명세 3장에는 이 값이 없다.
      const answer = a.freeText ? (option ? `${option.label} · ${a.freeText}` : a.freeText) : (option?.label ?? "-");
      return `${prompt}: ${answer}`;
    })
    .join("\n");
}
