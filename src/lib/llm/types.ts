// Anthropic 호출부의 입출력 타입과 에러 클래스.
//
// 출력 타입은 기술스펙 5-2 / 프롬프트 명세.md의 tool 스키마를 그대로 반영한다.
// mock/types.ts의 Critique/Premise(UI용, id·status 등을 포함)와는 다른 계층 —
// 이 모듈은 LLM 원시 출력만 다루고, DB row로 만드는 건 호출부(#47)의 몫이다.

import type { CheckType, PremiseKind, ThesisCategory } from "@/lib/mock/types";

export class LLMError extends Error {}

/** 세션의 LLM 호출 상한(20회)을 초과했을 때. */
export class LLMCallLimitExceededError extends LLMError {}

export interface CritiqueInput {
  sessionId: string;
  ticker: string;
  stockName: string;
  /** 데모 화이트리스트 27종에만 있다. 없으면 프롬프트에서 괄호째 빠진다 (#92). */
  sector?: string;
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
  /** 비교 방향은 이 값이 결정한다. 모델은 `lte`/`gte`를 고르지 않는다 (ADR-0007). */
  kind?: PremiseKind;
  metric?: "per" | "pbr";
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
