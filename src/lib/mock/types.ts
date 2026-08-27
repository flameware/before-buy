export type ThesisCategory =
  | "fundamental" // 실적·성장
  | "undervalued" // 저평가
  | "theme" // 테마·모멘텀
  | "dividend" // 배당
  | "technical" // 기술적 신호
  | "recommended" // 누가 추천해서
  | "gut"; // 그냥 느낌

export type CheckType = "price" | "valuation" | "fundamental" | "qualitative";

/**
 * 전제의 판정 결과. 앞의 넷은 **유지 조건**(지금 참이어야 하는 것)의 어휘이고, 뒤의 둘은
 * **도달 목표**(아직 오지 않은 기대)의 어휘다 — CONTEXT.md 참조.
 *
 * 도달 목표는 `intact`/`broken`을 쓰지 않는다. 미도달을 `intact`로 두면 "이 전제는
 * 유효하다"는 거짓말이 되고, `broken`으로 두면 아직 오지 않았을 뿐인 것이 "생각이 틀어졌다"로
 * 읽힌다. 어휘가 갈려 있으므로 **도달 목표는 배지에 투표할 수 없다** — `badgeState`가
 * `broken`만 세는 것으로 그 보장이 타입 수준에서 성립한다.
 */
export type PremiseStatus =
  | "intact"
  | "broken"
  | "pending"
  | "manual"
  | "awaiting"
  | "reached";

/**
 * 데모 시점 (CONTEXT.md). 전제 판정과 시세를 어느 시점 기준으로 볼지 고르는 값 —
 * 화면 필터가 아니라 판정의 입력이다. 불리언(`isFuture`)으로 다루면 그 사실이 가려져
 * "가격만 바뀌고 배지는 그대로"인 버그를 부른다(ADR-0004).
 */
export type DemoScenario = "current" | "future";

/**
 * 자동 확인 전제의 종류. **방향은 여기서 결정된다** — "손절선"이라고 말한 순간 비교
 * 방향은 정해지므로 `lte`/`gte`를 따로 받지 않는다(#85). 판정하는 쪽이 아니라 기록하는
 * 쪽이 방향을 고르게 두면, 문장은 손절선인데 비교는 반대인 조합이 아무 저항 없이 통과한다.
 *
 * - `stop-loss` — 가격 하한. 아래로 내려가면 깨짐. **유지 조건**
 * - `value-ceiling` — 상한. `metric`이 있으면 PER·PBR, 없으면 가격. 위로 넘으면 깨짐. **유지 조건**
 * - `target-price` — 가격 상한. 닿으면 `reached`. **도달 목표**
 */
export type PremiseKind = "stop-loss" | "value-ceiling" | "target-price";

/** `price`/`valuation` 전제를 시세와 비교하기 위한 기준. LLM이 채우고 DB에 저장된다. */
export interface PremiseCheckConfig {
  kind?: PremiseKind;
  /** `value-ceiling`에서만 의미가 있다. 없으면 가격 기준 상한. */
  metric?: "per" | "pbr";
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
