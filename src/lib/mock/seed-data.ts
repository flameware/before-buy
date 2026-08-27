import type { Premise, PremiseCheckConfig, QuoteSnapshot, Thesis, WatchlistItem } from "./types";

/**
 * 시드 전제 중 price/valuation 타입의 자동 판정 설정. 아래 시드 문구(예: "10만
 * 5,000원 이하일 때 저평가")를 엔진이 읽을 수 있는 {kind,metric,value}로 고정
 * 매핑한다 — qualitative 전제(seed-b-p3)는 자동 판정 대상이 아니므로 여기 없다.
 *
 * 방향은 `kind`가 결정한다 (ADR-0007). 이전에는 `operator`를 여기서 직접 골랐고,
 * 그 탓에 "목표가 210,000원"이 `lte`로 적혀 도달 목표가 유지 조건처럼 판정됐다.
 *
 * 프로비저닝(db/seed.ts)이 아니라 시드 정의 옆에 둔다. 서버 전용 모듈에 두면
 * 앱 밖의 유지보수 스크립트가 이 값을 읽지 못해 그대로 옮겨 적게 되고, 그렇게 갈린
 * 사본이 낡는 것이 #88이 남긴 교훈이다.
 */
export const SEED_PREMISE_CHECK_CONFIG: Record<string, PremiseCheckConfig> = {
  "seed-a-p1": { kind: "value-ceiling", value: 105_000 },
  "seed-b-p1": { kind: "value-ceiling", metric: "per", value: 44 },
  "seed-b-p2": { kind: "target-price", value: 210_000 },
  "seed-d-p1": { kind: "value-ceiling", value: 275_000 },
  "seed-e-p1": { kind: "value-ceiling", value: 48_500 },
};

/**
 * 데모 시드 5종 (기술스펙 7장). "현재" / "3개월 후" 두 값을 각각 들고 있다가
 * `resolveSeedItems(isFuture)`에서 하나로 합쳐 반환한다. 실사용자가 담은 종목은
 * 시나리오를 타지 않고 항상 실제(=현재) 데이터를 쓴다 (기술스펙 7장).
 *
 * price/valuation 전제의 자동 판정(engine.ts)은 현재 시점(isFuture=false)에는
 * 시드 종목도 실시간 KIS 시세를 baseline으로 쓴다 — 여기 적힌 "current" 값이
 * 아니라 위 `SEED_PREMISE_CHECK_CONFIG`의 임계값과 그 실시간 시세를 비교한다. 그래서 이 임계값들은 2026-08-26 KIS 실측가 기준으로 맞춰뒀다.
 * 절대값 비교라 시세가 계속 움직이면 다시 깨질 수 있다는 점은 감수한다
 * (issue #65).
 */

interface SeedPremiseVariant {
  base: Omit<Premise, "status" | "observedValue">;
  current: Pick<Premise, "status" | "observedValue">;
  future: Pick<Premise, "status" | "observedValue">;
}

interface SeedThesisVariant {
  category: Thesis["category"];
  followup: Thesis["followup"];
  freeText?: string;
  createdAt: string;
  critique: Thesis["critique"];
  premises: SeedPremiseVariant[];
}

interface SeedItem {
  id: string;
  ticker: string;
  status: WatchlistItem["status"];
  addedPrice: number;
  addedAt: string;
  avgBuyPrice?: number;
  boughtAt?: string;
  thesis?: SeedThesisVariant;
  quote: { current: QuoteSnapshot; future: QuoteSnapshot };
}

// 종목 A — SK텔레콤. 담은 뒤 매수까지 한 케이스(보유중). 저평가 전제는 105,000원 이하로
// 유지되다가, "3개월 후" 데모에서만 가격이 올라 깨진다 (기술스펙 7장).
const SEED_A: SeedItem = {
  id: "seed-a",
  ticker: "017670",
  status: "bought",
  addedPrice: 94_000,
  addedAt: "2026-07-20T09:00:00+09:00",
  avgBuyPrice: 96_000,
  boughtAt: "2026-07-25T09:30:00+09:00",
  quote: {
    current: { price: 99_600, changePercent: 0.7 },
    future: { price: 140_000, changePercent: 40.6 },
  },
  thesis: {
    category: "undervalued",
    followup: [
      { questionId: "cheap-vs-what", selected: "peers" },
      { questionId: "metric", selected: "price-itself" },
      { questionId: "target-price", selected: "custom", freeText: "105000" },
    ],
    freeText: "5G 요금제 개편 이후 반등 여지가 있어 보여서 담아요.",
    createdAt: "2026-07-20T09:04:00+09:00",
    critique: {
      isChallengeable: true,
      challengeReason: "'싸다'는 판단이 동종업계 대비일 뿐, 성장 정체 우려는 짚지 않음",
      counterpoints: [
        {
          point: "통신 3사 모두 비슷한 밸류에이션대에 있어, '동종업계 대비 저평가'가 상대적일 뿐 절대적 저평가는 아닐 수 있음",
          severity: "minor",
          basis: "업종 평균 대비 비교만으로는 업종 자체의 저평가 여부를 설명하지 못함",
        },
      ],
      openQuestions: ["통신 3사 전체가 저평가된 것은 아닌지도 같이 살펴보셨나요?"],
    },
    premises: [
      {
        base: {
          id: "seed-a-p1",
          statement: "10만 5,000원 이하일 때 저평가",
          checkType: "price",
        },
        current: { status: "intact", observedValue: "99,600원" },
        future: { status: "broken", observedValue: "140,000원" },
      },
    ],
  },
};

// 종목 B — 아모레퍼시픽. PER 전제는 "3개월 후" 데모에서 깨지고 목표가 전제는 계속
// 유지, qualitative 전제 1개 혼재.
const SEED_B: SeedItem = {
  id: "seed-b",
  ticker: "090430",
  status: "watching",
  addedPrice: 172_000,
  addedAt: "2026-06-18T14:20:00+09:00",
  quote: {
    current: { price: 143_500, changePercent: 0.1, per: 42.1 },
    future: { price: 195_800, changePercent: 13.8, per: 63.0 },
  },
  thesis: {
    category: "undervalued",
    followup: [
      { questionId: "cheap-vs-what", selected: "peers" },
      { questionId: "metric", selected: "per" },
      { questionId: "target-price", selected: "custom", freeText: "210000" },
    ],
    freeText: "중국향 매출 회복 기대. 다만 경쟁사 진입 가능성은 계속 지켜볼 생각.",
    createdAt: "2026-06-18T14:26:00+09:00",
    critique: {
      isChallengeable: false,
      counterpoints: [],
      openQuestions: ["중국향 매출 회복 속도를 다음 분기 실적에서 확인해보세요."],
    },
    premises: [
      {
        base: {
          id: "seed-b-p1",
          statement: "PER 44배 이하 유지",
          checkType: "valuation",
        },
        current: { status: "intact", observedValue: "42.1배" },
        future: { status: "broken", observedValue: "63.0배" },
      },
      {
        base: {
          id: "seed-b-p2",
          statement: "목표가 210,000원",
          checkType: "price",
        },
        // 도달 목표라 `intact`/`broken`이 아니다 — 210,000원에 아직 닿지 않았을 뿐이고,
        // 그 사실은 배지에 투표하지 않는다 (#85).
        current: { status: "awaiting", observedValue: "143,500원" },
        future: { status: "awaiting", observedValue: "195,800원" },
      },
      {
        base: {
          id: "seed-b-p3",
          statement: "경쟁사가 이 시장에 들어오지 않는다",
          checkType: "qualitative",
          manualNote: "3개월 뒤 알려드릴게요",
        },
        current: { status: "manual" },
        future: { status: "manual" },
      },
    ],
  },
};

// 종목 C — LG에너지솔루션. 근거 없이 담기만 한 케이스. 심사자가 직접 근거를 써볼 대상.
// 시드 5종 중 유일하게 의도적으로 "근거 없음" 배지를 유지한다.
const SEED_C: SeedItem = {
  id: "seed-c",
  ticker: "373220",
  status: "watching",
  addedPrice: 382_000,
  addedAt: "2026-08-10T11:00:00+09:00",
  quote: {
    current: { price: 351_000, changePercent: 0.4 },
    future: { price: 358_000, changePercent: 2.0 },
  },
};

// 종목 D — 삼성전자. 관심종목, 가격 전제 하나만으로 유지 중을 보여주는 단순 케이스.
const SEED_D: SeedItem = {
  id: "seed-d",
  ticker: "005930",
  status: "watching",
  addedPrice: 258_000,
  addedAt: "2026-08-05T10:00:00+09:00",
  quote: {
    current: { price: 261_500, changePercent: 1.8, per: 39.8 },
    future: { price: 300_000, changePercent: 14.7, per: 45.7 },
  },
  thesis: {
    category: "undervalued",
    followup: [
      { questionId: "cheap-vs-what", selected: "peers" },
      { questionId: "metric", selected: "price-itself" },
      { questionId: "target-price", selected: "custom", freeText: "275000" },
    ],
    freeText: "메모리 업사이클 초입이라 보고, 파운드리도 바닥은 지났다고 판단해서 담아요.",
    createdAt: "2026-08-05T10:05:00+09:00",
    critique: {
      isChallengeable: true,
      challengeReason: "업사이클 시점 판단이 본인 추정일 뿐, 실제 지표(재고·가격 추이)로 뒷받침되지 않음",
      counterpoints: [
        {
          point: "메모리 업사이클 '초입'이라는 판단이 특정 지표 없이 심증에 가까움",
          severity: "minor",
          basis: "재고 수준이나 고정가 추이 같은 근거가 followup에 없음",
        },
      ],
      openQuestions: ["다음 분기 메모리 고정가 발표를 확인해보셨나요?"],
    },
    premises: [
      {
        base: {
          id: "seed-d-p1",
          statement: "27만 5,000원 이하일 때 저평가",
          checkType: "price",
        },
        current: { status: "intact", observedValue: "261,500원" },
        future: { status: "broken", observedValue: "300,000원" },
      },
    ],
  },
};

// 종목 E — 카카오페이. 보유중, 매수가 대비 이미 수익 구간이라 "좋은 소식"과
// 저평가 전제 유지가 함께 가는 무난한 케이스.
const SEED_E: SeedItem = {
  id: "seed-e",
  ticker: "377300",
  status: "bought",
  addedPrice: 37_000,
  addedAt: "2026-07-01T09:00:00+09:00",
  avgBuyPrice: 38_200,
  boughtAt: "2026-07-03T09:30:00+09:00",
  quote: {
    current: { price: 46_300, changePercent: 0.4 },
    future: { price: 55_000, changePercent: 18.8 },
  },
  thesis: {
    category: "undervalued",
    followup: [
      { questionId: "cheap-vs-what", selected: "peers" },
      { questionId: "metric", selected: "price-itself" },
      { questionId: "target-price", selected: "custom", freeText: "48500" },
    ],
    freeText: "간편결제 점유율이 계속 오르고 있고, 흑자전환 기대감도 있어서 매수했어요.",
    createdAt: "2026-07-01T09:04:00+09:00",
    critique: {
      isChallengeable: true,
      challengeReason: "흑자전환 '기대감'이 실제 손익분기 시점 추정 없이 막연함",
      counterpoints: [
        {
          point: "흑자전환 시점에 대한 구체적 근거(분기별 적자 축소 추이 등) 없이 기대감만 언급됨",
          severity: "minor",
          basis: "followup에 손익 관련 지표가 등장하지 않음",
        },
      ],
      openQuestions: ["최근 분기 영업손실 규모가 줄어드는 추세인지 확인해보셨나요?"],
    },
    premises: [
      {
        base: {
          id: "seed-e-p1",
          statement: "4만 8,500원 이하일 때 저평가",
          checkType: "price",
        },
        current: { status: "intact", observedValue: "46,300원" },
        future: { status: "broken", observedValue: "55,000원" },
      },
    ],
  },
};

export const SEED_ITEMS: SeedItem[] = [SEED_A, SEED_B, SEED_C, SEED_D, SEED_E];

function resolvePremise(v: SeedPremiseVariant, isFuture: boolean): Premise {
  const variant = isFuture ? v.future : v.current;
  return { ...v.base, ...variant };
}

function resolveThesis(t: SeedThesisVariant, isFuture: boolean): Thesis {
  return {
    category: t.category,
    followup: t.followup,
    freeText: t.freeText,
    createdAt: t.createdAt,
    critique: t.critique,
    premises: t.premises.map((p) => resolvePremise(p, isFuture)),
  };
}

/** 시드 3종을 데모 오프셋(`isFuture`)에 맞춰 하나의 배열로 합친다. */
export function resolveSeedItems(isFuture: boolean): WatchlistItem[] {
  return SEED_ITEMS.map((s) => ({
    id: s.id,
    ticker: s.ticker,
    status: s.status,
    isSeed: true,
    addedPrice: s.addedPrice,
    addedAt: s.addedAt,
    avgBuyPrice: s.avgBuyPrice,
    boughtAt: s.boughtAt,
    thesis: s.thesis ? resolveThesis(s.thesis, isFuture) : undefined,
  }));
}

export function resolveSeedQuote(ticker: string, isFuture: boolean): QuoteSnapshot | undefined {
  const seed = SEED_ITEMS.find((s) => s.ticker === ticker);
  if (!seed) return undefined;
  return isFuture ? seed.quote.future : seed.quote.current;
}
