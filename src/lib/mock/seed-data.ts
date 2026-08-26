import type { Premise, QuoteSnapshot, Thesis, WatchlistItem } from "./types";

/**
 * 데모 시드 3종 (기술스펙 7장). "현재" / "3개월 후" 두 값을 각각 들고 있다가
 * `resolveSeedItems(isFuture)`에서 하나로 합쳐 반환한다. 실사용자가 담은 종목은
 * 시나리오를 타지 않고 항상 실제(=현재) 데이터를 쓴다 (기술스펙 7장).
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

// 종목 A — SK텔레콤. 담은 뒤 매수까지 한 케이스(보유중), 가격이 올라 저평가 전제가 깨진다.
// "좋은 소식인데 내 근거는 무효가 된" 케이스 (기술스펙 7장).
const SEED_A: SeedItem = {
  id: "seed-a",
  ticker: "017670",
  status: "bought",
  addedPrice: 29_800,
  addedAt: "2026-05-18T09:00:00+09:00",
  avgBuyPrice: 30_800,
  boughtAt: "2026-05-23T09:30:00+09:00",
  quote: {
    current: { price: 31_200, changePercent: 4.7 },
    future: { price: 42_000, changePercent: 40.9 },
  },
  thesis: {
    category: "undervalued",
    followup: [
      { questionId: "cheap-vs-what", selected: "peers" },
      { questionId: "metric", selected: "price-itself" },
      { questionId: "target-price", selected: "custom", freeText: "32000" },
    ],
    freeText: "5G 요금제 개편 이후 반등 여지가 있어 보여서 담아요.",
    createdAt: "2026-05-18T09:04:00+09:00",
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
          statement: "3만 2,000원 이하일 때 저평가",
          checkType: "price",
        },
        current: { status: "intact", observedValue: "31,200원" },
        future: { status: "broken", observedValue: "42,000원" },
      },
    ],
  },
};

// 종목 B — 아모레퍼시픽. PER 전제는 깨지고 목표가 전제는 유지, qualitative 전제 1개 혼재.
const SEED_B: SeedItem = {
  id: "seed-b",
  ticker: "090430",
  status: "watching",
  addedPrice: 172_000,
  addedAt: "2026-06-18T14:20:00+09:00",
  quote: {
    current: { price: 186_500, changePercent: 8.4, per: 14.8 },
    future: { price: 195_800, changePercent: 13.8, per: 21.3 },
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
          statement: "PER 15배 이하 유지",
          checkType: "valuation",
        },
        current: { status: "intact", observedValue: "14.8배" },
        future: { status: "broken", observedValue: "21.3배" },
      },
      {
        base: {
          id: "seed-b-p2",
          statement: "목표가 210,000원",
          checkType: "price",
        },
        current: { status: "intact", observedValue: "186,500원" },
        future: { status: "intact", observedValue: "195,800원" },
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
const SEED_C: SeedItem = {
  id: "seed-c",
  ticker: "373220",
  status: "watching",
  addedPrice: 382_000,
  addedAt: "2026-08-10T11:00:00+09:00",
  quote: {
    current: { price: 385_000, changePercent: 0.8 },
    future: { price: 391_500, changePercent: 2.5 },
  },
};

export const SEED_ITEMS: SeedItem[] = [SEED_A, SEED_B, SEED_C];

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
