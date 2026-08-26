// S1 관심종목 목록의 실 데이터 조회 (지도 #38 destination). 세션 소유 watchlist_items를
// DB에서 읽고, 전제 판정 엔진을 먼저 돌려 최신 상태로 만든 뒤, 시세(시드는 fixture,
// 그 외는 KIS 배치 조회)를 붙여 반환한다. Server Action(actions.ts)이 이 함수를 감싼다.

import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { critiques, premises, theses, watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";
import { evaluateWatchlistPremises } from "@/lib/premises/engine";
import { getKoreanStockPrices } from "@/lib/kis/batch-quote";
import { resolveSeedQuote } from "@/lib/mock/seed-data";
import type { Critique, FollowupAnswer, Premise, QuoteSnapshot, Thesis, WatchlistItem } from "@/lib/mock/types";

export interface WatchlistViewItem extends WatchlistItem {
  name: string;
  /** null이면 시세 조회 실패 — 화면은 가격 대신 실패 안내를 보여준다. */
  quote: QuoteSnapshot | null;
}

/** S1 목록: 화면에 보이는(watching/bought) 종목만 실 데이터로 조회한다. */
export async function getWatchlistView(isFuture: boolean): Promise<WatchlistViewItem[]> {
  return withSession(async (sessionId) => {
    await evaluateWatchlistPremises(sessionId, isFuture);

    const items = await db
      .select()
      .from(watchlistItems)
      .where(and(eq(watchlistItems.sessionId, sessionId), inArray(watchlistItems.status, ["watching", "bought"])))
      .orderBy(watchlistItems.createdAt);

    if (items.length === 0) return [];

    const theseByItem = await fetchLatestTheses(items.map((i) => i.id));
    const quotes = await resolveQuotes(items, isFuture);

    return items.map((item) => {
      const thesis = theseByItem.get(item.id);
      const quote = quotes.get(item.ticker) ?? null;
      return {
        id: item.id,
        ticker: item.ticker,
        name: item.name,
        status: item.status as WatchlistItem["status"],
        isSeed: item.isSeed,
        addedPrice: item.addedPrice != null ? Number(item.addedPrice) : 0,
        addedAt: item.addedAt?.toISOString() ?? item.createdAt.toISOString(),
        avgBuyPrice: item.avgBuyPrice != null ? Number(item.avgBuyPrice) : undefined,
        boughtAt: item.boughtAt?.toISOString(),
        thesis,
        quote,
      };
    });
  });
}

async function fetchLatestTheses(watchlistItemIds: string[]): Promise<Map<string, Thesis>> {
  const thesisRows = await db
    .select()
    .from(theses)
    .where(inArray(theses.watchlistItemId, watchlistItemIds))
    .orderBy(desc(theses.version));

  const latestByItem = new Map<string, typeof thesisRows[number]>();
  for (const row of thesisRows) {
    if (!latestByItem.has(row.watchlistItemId)) latestByItem.set(row.watchlistItemId, row);
  }
  if (latestByItem.size === 0) return new Map();

  const thesisIds = [...latestByItem.values()].map((t) => t.id);
  const [premiseRows, critiqueRows] = await Promise.all([
    db.select().from(premises).where(inArray(premises.thesisId, thesisIds)),
    db.select().from(critiques).where(inArray(critiques.thesisId, thesisIds)),
  ]);

  const premisesByThesis = new Map<string, Premise[]>();
  for (const p of premiseRows) {
    const list = premisesByThesis.get(p.thesisId) ?? [];
    list.push({
      id: p.id,
      statement: p.statement,
      checkType: p.checkType as Premise["checkType"],
      status: p.status as Premise["status"],
      observedValue: p.observedValue ?? undefined,
    });
    premisesByThesis.set(p.thesisId, list);
  }

  const critiqueByThesis = new Map<string, Critique>();
  for (const c of critiqueRows) {
    critiqueByThesis.set(c.thesisId, {
      isChallengeable: c.isChallengeable,
      counterpoints: (c.counterpoints as Critique["counterpoints"]) ?? [],
      openQuestions: (c.openQuestions as string[]) ?? [],
    });
  }

  const result = new Map<string, Thesis>();
  for (const [itemId, row] of latestByItem) {
    result.set(itemId, {
      category: row.category as Thesis["category"],
      followup: (row.followup as FollowupAnswer[]) ?? [],
      freeText: row.freeText ?? undefined,
      createdAt: row.createdAt.toISOString(),
      critique: critiqueByThesis.get(row.id) ?? { isChallengeable: false, counterpoints: [], openQuestions: [] },
      premises: premisesByThesis.get(row.id) ?? [],
    });
  }
  return result;
}

/**
 * 시드 종목도 현재 시점(isFuture=false)에는 그 외 종목과 동일하게 KIS 실전 도메인
 * 배치 조회 결과를 쓴다. "3개월 후" 토글일 때만 시드 종목에 한해 데모 오프셋에 맞는
 * fixture 시세를 참조한다. 개별 종목 조회 실패는 `null`로 표시해 화면이 폴백을 그리게 한다.
 */
async function resolveQuotes(
  items: { ticker: string; isSeed: boolean }[],
  isFuture: boolean
): Promise<Map<string, QuoteSnapshot | null>> {
  const quotes = new Map<string, QuoteSnapshot | null>();

  if (isFuture) {
    const seedTickers = [...new Set(items.filter((i) => i.isSeed).map((i) => i.ticker))];
    for (const ticker of seedTickers) {
      quotes.set(ticker, resolveSeedQuote(ticker, true) ?? null);
    }
  }

  const liveTickers = [...new Set(items.filter((i) => !i.isSeed || !isFuture).map((i) => i.ticker))];
  if (liveTickers.length > 0) {
    const liveResults = await getKoreanStockPrices(liveTickers);
    for (const ticker of liveTickers) {
      const result = liveResults.get(ticker);
      quotes.set(
        ticker,
        result?.ok
          ? {
              price: result.data.price,
              changePercent: result.data.changePercent ?? 0,
              per: result.data.per,
              pbr: result.data.pbr,
            }
          : null
      );
    }
  }

  return quotes;
}
