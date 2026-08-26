import { getCategory } from "./categories";
import type { Critique, FollowupAnswer, Premise, ThesisCategory } from "./types";

/**
 * S3용 mock "AI" 판정. 실제 LLM 연동은 다음 맵(API 연동)의 일 — 여기서는
 * 카테고리별로 고정된 challengeable 여부와 전제 세트를 만들어 화면명세 6장의
 * "도출 전제" 표를 재현한다.
 */
function answerValue(followup: FollowupAnswer[], questionId: string): string | undefined {
  const answer = followup.find((a) => a.questionId === questionId);
  if (!answer || answer.skipped) return undefined;
  return answer.freeText?.trim() || answer.selected;
}

const CHALLENGEABLE_CATEGORIES: Set<ThesisCategory> = new Set(["theme", "recommended", "gut"]);

export function generateCritique(category: ThesisCategory, followup: FollowupAnswer[]): Critique {
  const isChallengeable = CHALLENGEABLE_CATEGORIES.has(category);

  switch (category) {
    case "theme": {
      const themeName = answerValue(followup, "theme-name") ?? "이 테마";
      return {
        isChallengeable,
        challengeReason: `"${themeName}"가 언제까지 갈지는 시장 심리에 달려 있어 근거로 삼기 약함`,
        counterpoints: [
          {
            point: "테마성 흐름은 실적 개선과 무관하게 꺼질 수 있음",
            severity: "major",
            basis: "가격 상승이 펀더멘털이 아니라 수급·심리에 기반한 경우가 많음",
          },
        ],
        openQuestions: ["테마가 식었다는 신호가 나오면 정말 정리하실 건가요?"],
      };
    }
    case "recommended": {
      const source = answerValue(followup, "source") ?? "그분";
      return {
        isChallengeable,
        challengeReason: `${source}의 판단을 직접 검증하지 않고 그대로 따르는 형태`,
        counterpoints: [
          {
            point: "추천한 사람의 판단 근거를 직접 확인하지 않으면 같은 실수를 반복하기 쉬움",
            severity: "major",
            basis: "제3자의 확신이 실제 데이터를 대체할 수는 없음",
          },
        ],
        openQuestions: ["추천 이유를 스스로 다시 한번 확인해보시겠어요?"],
      };
    }
    case "gut":
      return {
        isChallengeable,
        challengeReason: "관측 가능한 근거 없이 느낌만으로 담은 종목",
        counterpoints: [
          {
            point: "근거가 없으면 무엇이 틀렸는지도 알 수 없어 손절 판단이 늦어지기 쉬움",
            severity: "major",
            basis: "비교할 기준값 자체가 없음",
          },
        ],
        openQuestions: ["틀렸을 때 알아챌 수 있는 나만의 기준이 있을까요?"],
      };
    case "undervalued":
      return {
        isChallengeable,
        counterpoints: [],
        openQuestions: ["목표가에 가까워지면 어디까지 지켜보실지 미리 정해두면 좋아요."],
      };
    case "fundamental":
      return {
        isChallengeable,
        counterpoints: [],
        openQuestions: ["다음 실적 발표에서 기대한 지표가 실제로 확인되는지 지켜보세요."],
      };
    case "dividend":
      return {
        isChallengeable,
        counterpoints: [],
        openQuestions: ["배당 정책이 바뀌는 공시가 나오면 알림으로 알려드릴게요."],
      };
    case "technical":
      return {
        isChallengeable,
        counterpoints: [],
        openQuestions: ["정하신 손절가·목표가에 도달하면 계획대로 실행하실 수 있을지 한 번 더 생각해보세요."],
      };
  }
}

export function generatePremises(ticker: string, category: ThesisCategory, followup: FollowupAnswer[]): Premise[] {
  const def = getCategory(category);
  const valueQuestionId = def.questions.find((q) => q.isValueQuestion)?.id;
  const targetValue = valueQuestionId ? answerValue(followup, valueQuestionId) : undefined;

  switch (category) {
    case "undervalued":
      return [
        {
          id: `${ticker}-p-valuation`,
          statement: "저평가 판단 지표(PER/PBR 등) 유지",
          checkType: "valuation",
          status: "pending",
        },
        {
          id: `${ticker}-p-price`,
          statement: targetValue ? `목표가 ${targetValue}원` : "정하신 목표가 도달 여부",
          checkType: "price",
          status: "pending",
        },
      ];
    case "technical":
      return [
        {
          id: `${ticker}-p-price`,
          statement: targetValue ? `목표가·손절가 ${targetValue}원 기준 유지` : "목표가·손절가 기준 유지",
          checkType: "price",
          status: "pending",
        },
      ];
    case "theme":
      return [
        {
          id: `${ticker}-p-price`,
          statement: "주가 흐름 유지",
          checkType: "price",
          status: "pending",
        },
        {
          id: `${ticker}-p-qualitative`,
          statement: "테마가 식지 않음 (거래량·관련 뉴스 등)",
          checkType: "qualitative",
          status: "pending",
          manualNote: "3개월 뒤 알려드릴게요",
        },
      ];
    case "fundamental":
      return [
        {
          id: `${ticker}-p-fundamental`,
          statement: "기대한 성장(매출·이익 등)이 실제로 확인됨",
          checkType: "fundamental",
          status: "pending",
          manualNote: "3개월 뒤 알려드릴게요",
        },
      ];
    case "dividend":
      return [
        {
          id: `${ticker}-p-fundamental`,
          statement: "배당 정책 유지",
          checkType: "fundamental",
          status: "pending",
          manualNote: "3개월 뒤 알려드릴게요",
        },
        {
          id: `${ticker}-p-qualitative`,
          statement: "보유를 지속할 다른 이유가 여전히 유효함",
          checkType: "qualitative",
          status: "pending",
          manualNote: "3개월 뒤 알려드릴게요",
        },
      ];
    case "recommended":
      return [
        {
          id: `${ticker}-p-qualitative`,
          statement: "추천받은 이유를 직접 확인함",
          checkType: "qualitative",
          status: "pending",
          manualNote: "3개월 뒤 알려드릴게요",
        },
      ];
    case "gut":
      return [];
  }
}
