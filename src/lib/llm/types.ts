// Anthropic 호출부의 입출력 타입과 에러 클래스.
//
// 출력 타입은 기술스펙 5-2 / 프롬프트 명세.md의 tool 스키마를 그대로 반영한다.
// mock/types.ts의 Critique/Premise(UI용, id·status 등을 포함)와는 다른 계층 —
// 이 모듈은 LLM 원시 출력만 다루고, DB row로 만드는 건 호출부(#47)의 몫이다.

import type { CheckType, ThesisCategory } from "@/lib/mock/types";

export class LLMError extends Error {}

/** 세션의 LLM 호출 상한(20회)을 초과했을 때. */
export class LLMCallLimitExceededError extends LLMError {}

export interface CritiqueInput {
  sessionId: string;
  ticker: string;
  stockName: string;
  sector: string;
  category: ThesisCategory;
  /** 후속 질문 프롬프트와 답변(건너뜀 포함)을 이미 사람이 읽을 문자열로 변환한 것. */
  followupSummary: string;
  freeText?: string;
  price: number;
  per?: number;
  pbr?: number;
}

export interface LLMCounterpoint {
  point: string;
  severity: "major" | "minor";
  basis: string;
}

export type LLMCheckConfig = {
  metric?: "per" | "pbr";
  operator?: "lte" | "gte";
  value?: number;
  period?: string;
};

export interface LLMPremise {
  statement: string;
  checkType: CheckType;
  checkConfig?: LLMCheckConfig;
}

export interface CritiqueOutput {
  isChallengeable: boolean;
  challengeReason?: string;
  counterpoints: LLMCounterpoint[];
  openQuestions: string[];
  premises: LLMPremise[];
  /** 검증·감사용 원문 tool 입력. critiques.raw_response에 그대로 저장할 재료. */
  rawResponse: unknown;
}
