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
