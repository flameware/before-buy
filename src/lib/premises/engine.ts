// 전제 판정 엔진 (기술스펙 6장). check_type별 분기:
//   price / valuation — 시세 기반 자동 판정. 이 파일이 유일하게 다루는 대상.
//   fundamental / qualitative — "직접 확인" 대상(화면명세 6장). 자동 판정하지 않고
//     건드리지 않는다 — status는 생성 시점(#47, 시드 프로비저닝)에 결정된 값을 유지한다.
//
// 두 진입점을 제공한다: S1 목록 로드 시 화면에 보이는 전체 종목 배치 판정
// (evaluateWatchlistPremises), S5 상세 진입 시 해당 종목 단건 재판정
// (evaluateItemPremises). 둘 다 세션 소유를 직접 검증하는 순수 서버 함수 —
// Server Action이 아니다. 화면 배선은 이 함수를 호출하는 쪽(#44/#49)의 몫이다.

import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { premises, theses, watchlistItems } from "../db/schema";
import { getKoreanStockPrices } from "../kis/batch-quote";
import { resolveSeedQuote } from "../mock/seed-data";

interface WatchlistTarget {
  id: string;
  ticker: string;
  isSeed: boolean;
}

interface Quote {
  price: number;
  per?: number;
  pbr?: number;
}

interface CheckConfig {
  metric?: "per" | "pbr";
  operator?: "lte" | "gte";
  value?: number;
}

interface CheckResult {
  status: "intact" | "broken";
  observedValue: string;
}

const AUTO_CHECK_TYPES = new Set(["price", "valuation"]);

/** S1 목록 로드 시: 화면에 보이는(watching/bought) 전체 종목을 배치 판정한다. */
export async function evaluateWatchlistPremises(
  sessionId: string,
  isFuture: boolean
): Promise<void> {
  const targets = await db
    .select({ id: watchlistItems.id, ticker: watchlistItems.ticker, isSeed: watchlistItems.isSeed })
    .from(watchlistItems)
    .where(
      and(eq(watchlistItems.sessionId, sessionId), inArray(watchlistItems.status, ["watching", "bought"]))
    );

  await evaluateForTargets(targets, isFuture);
}

/** S5 상세 진입 시: 해당 종목 1건만 재판정한다. 다른 세션 소유 항목은 조용히 무시한다. */
export async function evaluateItemPremises(
  sessionId: string,
  watchlistItemId: string,
  isFuture: boolean
): Promise<void> {
  const [target] = await db
    .select({ id: watchlistItems.id, ticker: watchlistItems.ticker, isSeed: watchlistItems.isSeed })
    .from(watchlistItems)
    .where(and(eq(watchlistItems.sessionId, sessionId), eq(watchlistItems.id, watchlistItemId)));

  if (!target) return;
  await evaluateForTargets([target], isFuture);
}

async function evaluateForTargets(targets: WatchlistTarget[], isFuture: boolean): Promise<void> {
  if (targets.length === 0) return;

  const latestThesisByItem = await fetchLatestTheses(targets.map((t) => t.id));
  if (latestThesisByItem.size === 0) return;

  const thesisIds = [...latestThesisByItem.values()].map((t) => t.id);
  const allPremises = await db.select().from(premises).where(inArray(premises.thesisId, thesisIds));
  const evaluable = allPremises.filter((p) => AUTO_CHECK_TYPES.has(p.checkType));
  if (evaluable.length === 0) return;

  const targetByThesisId = new Map<string, WatchlistTarget>();
  for (const target of targets) {
    const thesis = latestThesisByItem.get(target.id);
    if (thesis) targetByThesisId.set(thesis.id, target);
  }

  const quotes = await resolveQuotes(targets, isFuture);
  const now = new Date();

  await Promise.all(
    evaluable.map(async (premise) => {
      const target = targetByThesisId.get(premise.thesisId);
      if (!target) return;

      const quote = quotes.get(target.ticker) ?? null;
      const result = evaluateCheck(premise.checkType, parseCheckConfig(premise.checkConfig), quote);
      if (!result) return; // 시세 미확보 또는 설정 불완전 — 이전 상태를 그대로 둔다

      const brokenAt =
        result.status === "broken" ? (premise.status === "broken" ? premise.brokenAt : now) : null;

      await db
        .update(premises)
        .set({
          status: result.status,
          observedValue: result.observedValue,
          lastCheckedAt: now,
          brokenAt,
        })
        .where(eq(premises.id, premise.id));
    })
  );
}

/** watchlist_item당 최신 버전(version 최댓값)의 thesis 하나만 판정 대상으로 삼는다. */
async function fetchLatestTheses(
  watchlistItemIds: string[]
): Promise<Map<string, { id: string; version: number }>> {
  if (watchlistItemIds.length === 0) return new Map();

  const rows = await db
    .select({ id: theses.id, watchlistItemId: theses.watchlistItemId, version: theses.version })
    .from(theses)
    .where(inArray(theses.watchlistItemId, watchlistItemIds))
    .orderBy(desc(theses.version));

  const latestByItem = new Map<string, { id: string; version: number }>();
  for (const row of rows) {
    if (!latestByItem.has(row.watchlistItemId)) {
      latestByItem.set(row.watchlistItemId, { id: row.id, version: row.version });
    }
  }
  return latestByItem;
}

/**
 * 시드 종목도 현재 시점(isFuture=false)에는 그 외 종목과 동일하게 KIS 실전 도메인
 * 실시간 시세를 쓴다. "3개월 후" 토글(isFuture=true)일 때만 시드 종목에 한해
 * `resolveSeedQuote`의 fixture future 값을 참조한다 — 지도 Destination 참고.
 */
async function resolveQuotes(
  targets: WatchlistTarget[],
  isFuture: boolean
): Promise<Map<string, Quote | null>> {
  const quotes = new Map<string, Quote | null>();

  if (isFuture) {
    const seedTickers = [...new Set(targets.filter((t) => t.isSeed).map((t) => t.ticker))];
    for (const ticker of seedTickers) {
      const seedQuote = resolveSeedQuote(ticker, true);
      quotes.set(ticker, seedQuote ? { price: seedQuote.price, per: seedQuote.per, pbr: seedQuote.pbr } : null);
    }
  }

  const liveTickers = [...new Set(targets.filter((t) => !t.isSeed || !isFuture).map((t) => t.ticker))];
  if (liveTickers.length > 0) {
    const liveResults = await getKoreanStockPrices(liveTickers);
    for (const ticker of liveTickers) {
      const result = liveResults.get(ticker);
      quotes.set(ticker, result?.ok ? { price: result.data.price, per: result.data.per, pbr: result.data.pbr } : null);
    }
  }

  return quotes;
}

function parseCheckConfig(raw: unknown): CheckConfig {
  if (!raw || typeof raw !== "object") return {};
  const c = raw as Record<string, unknown>;
  return {
    metric: c.metric === "per" || c.metric === "pbr" ? c.metric : undefined,
    operator: c.operator === "lte" || c.operator === "gte" ? c.operator : undefined,
    value: typeof c.value === "number" ? c.value : undefined,
  };
}

function evaluateCheck(checkType: string, config: CheckConfig, quote: Quote | null): CheckResult | null {
  if (!quote || config.operator == null || config.value == null) return null;

  if (checkType === "price") {
    return applyOperator(quote.price, config.operator, config.value, formatWon);
  }

  if (checkType === "valuation") {
    if (!config.metric) return null;
    const observed = quote[config.metric];
    if (observed == null) return null;
    return applyOperator(observed, config.operator, config.value, formatMultiple);
  }

  return null;
}

function applyOperator(
  observed: number,
  operator: "lte" | "gte",
  value: number,
  format: (n: number) => string
): CheckResult {
  const holds = operator === "lte" ? observed <= value : observed >= value;
  return { status: holds ? "intact" : "broken", observedValue: format(observed) };
}

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatMultiple(n: number): string {
  return `${n.toFixed(1)}배`;
}
