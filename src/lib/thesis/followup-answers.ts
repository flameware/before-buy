// S2 Step 2의 "답했는가"를 정하는 규칙. 화면에서 떼어 둔 이유는 이 규칙이 세 곳의
// 결과를 한꺼번에 정하기 때문이다: `다음` 버튼의 활성 여부, theses.followup에 저장될
// 배열, 그리고 그 배열을 읽는 LLM 프롬프트.
//
// 모델은 하나다 — **안 고른 것은 곧 건너뛴 것**(#96). 예전에는 질문마다 달린
// `건너뛰기` 버튼이 이걸 명시적 행위로 만들었지만, 그 버튼은 선택 해제가 막혀 있어
// 생긴 우회로였다. 칩이 토글이 된 지금은 무선택이 그 뜻을 그대로 표현한다.

import type { FollowupAnswer, FollowupQuestion } from "@/lib/mock";

const CUSTOM_VALUE = "custom";

/** 실제로 답이 담긴 문항인가. 무선택·빈 자유입력은 모두 false(= 건너뜀). */
export function isAnswered(
  question: FollowupQuestion,
  answer: FollowupAnswer | undefined
): boolean {
  if (!answer) return false;
  if (question.options.length === 0) return !!answer.freeText?.trim();
  if (answer.selected === CUSTOM_VALUE) return !!answer.freeText?.trim();
  return !!answer.selected;
}

/**
 * 무선택 문항을 `skipped`로 채워 followup 배열을 완성한다.
 *
 * 배열에서 빼지 않는다: `buildFollowupSummary`와 S5 상세가 "안 물어본 질문"과
 * "답하지 않은 질문"을 구별할 수 있어야 하고, 사용자도 S5에서 자기가 무엇을 비워뒀는지
 * 볼 수 있어야 한다.
 */
export function toFollowupAnswers(
  questions: FollowupQuestion[],
  answers: Record<string, FollowupAnswer>
): FollowupAnswer[] {
  return questions.map((q) =>
    isAnswered(q, answers[q.id]) ? answers[q.id] : { questionId: q.id, skipped: true }
  );
}

/**
 * Step 2의 `다음`이 열리는 조건 — 최소 한 문항.
 *
 * "모든 문항이 결판났는가"였던 예전 조건은 무선택=건너뜀 아래에서 진입 순간 이미 참이라
 * 게이트 구실을 못 한다. 그대로 두면 Step 2를 통째로 지나칠 수 있고, 그 경로에서는 각
 * 카테고리의 값 질문(목표가·손절가·기간)이 비어 `checkConfig`가 나오지 않아 자동 확인
 * 전제가 0개가 된다 — 근거는 있는데 배지가 영영 "유지 중"에 머무는 종목이 생긴다.
 * "아무것도 쓰지 않겠다"는 Step 1의 건너뛰기가 받는다.
 */
export function canLeaveFollowups(
  questions: FollowupQuestion[],
  answers: Record<string, FollowupAnswer>
): boolean {
  return questions.some((q) => isAnswered(q, answers[q.id]));
}
