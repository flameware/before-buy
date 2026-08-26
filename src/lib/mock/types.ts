export type ThesisCategory =
  | "fundamental" // 실적·성장
  | "undervalued" // 저평가
  | "theme" // 테마·모멘텀
  | "dividend" // 배당
  | "technical" // 기술적 신호
  | "recommended" // 누가 추천해서
  | "gut"; // 그냥 느낌

export type CheckType = "price" | "valuation" | "fundamental" | "qualitative";

export type PremiseStatus = "intact" | "broken" | "pending" | "manual";

/**
 * 데모 시점 (CONTEXT.md). 전제 판정과 시세를 어느 시점 기준으로 볼지 고르는 값 —
 * 화면 필터가 아니라 판정의 입력이다. 불리언(`isFuture`)으로 다루면 그 사실이 가려져
 * "가격만 바뀌고 배지는 그대로"인 버그를 부른다(ADR-0004).
 */
export type DemoScenario = "current" | "future";

/** `price`/`valuation` 전제를 시세와 비교하기 위한 기준. LLM이 채우고 DB에 저장된다. */
export interface PremiseCheckConfig {
  metric?: "per" | "pbr";
  operator?: "lte" | "gte";
  value?: number;
}

export type WatchlistStatus = "watching" | "bought" | "removed";

/** 카드 배지 3상태. `watchlist_items`/`theses`/`premises`에서 파생 — 별도 저장 안 함. */
export type BadgeState = "no-thesis" | "intact" | "changed";

export interface FollowupAnswer {
  questionId: string;
  selected?: string;
  freeText?: string;
  skipped?: boolean;
}

export interface Stock {
  ticker: string;
  name: string;
  sector: string;
  exchange: "KOSPI" | "KOSDAQ";
}

/** 데모 오프셋에 따라 갈리는 시세 스냅샷. */
export interface QuoteSnapshot {
  price: number;
  changePercent: number;
  /** valuation 전제 판정용. 시드가 아닌 종목은 대부분 비워둠. */
  per?: number;
  pbr?: number;
}

export interface Premise {
  id: string;
  statement: string;
  checkType: CheckType;
  /**
   * `price`/`valuation` 전제는 이 값이 시세와 만나 status가 **계산**된다 — 저장된
   * status는 무시된다. `fundamental`/`qualitative`는 반대로 저장된 status가 유일한
   * 출처다(ADR-0004). 두 출처를 합치는 일은 `resolvePremises`가 맡는다.
   */
  checkConfig?: PremiseCheckConfig;
  status: PremiseStatus;
  baselineValue?: string;
  observedValue?: string;
  /** manual 전제의 "3개월 뒤 알려드릴게요" 같은 안내 문구. */
  manualNote?: string;
}

export interface Counterpoint {
  point: string;
  severity: "major" | "minor";
  basis: string;
}

export interface Critique {
  isChallengeable: boolean;
  challengeReason?: string;
  counterpoints: Counterpoint[];
  openQuestions: string[];
}

export interface Thesis {
  category: ThesisCategory;
  followup: FollowupAnswer[];
  freeText?: string;
  createdAt: string;
  critique: Critique;
  premises: Premise[];
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  status: WatchlistStatus;
  isSeed: boolean;
  addedPrice: number;
  addedAt: string;
  avgBuyPrice?: number;
  boughtAt?: string;
  thesis?: Thesis;
}
