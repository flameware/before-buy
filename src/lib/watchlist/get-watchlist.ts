// S1 관심종목 목록의 실 데이터 조회 (지도 #38 destination). 세션 소유 watchlist_items를
// DB에서 읽고, 전제 판정 엔진을 먼저 돌려 최신 상태로 만든 뒤, 시세(시드는 fixture,
// 그 외는 KIS 배치 조회)를 붙여 반환한다. Server Action(actions.ts)이 이 함수를 감싼다.
//
// ADR-0002: 목록(DB: 종목/근거/전제)과 시세(KIS)는 클라이언트에서 서로 다른 캐시
// 수명으로 다뤄야 해서 두 개의 독립된 조회로 분리했다 — getWatchlistListView가
// 목록을, resolveQuotes(quote 부분만 필요한 곳에서 별도 호출)가 시세를 맡는다.

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

/** 시세를 아직 붙이지 않은 목록 항목 — S1이 목록 쿼리와 시세 쿼리를 분리 캐싱하는 데 쓴다. */
export type WatchlistListItem = Omit<WatchlistViewItem, "quote">;

/** S1 목록(DB 부분만): 화면에 보이는(watching/bought) 종목의 근거/전제 상태를 조회한다. 시세는 포함하지 않는다. */
export async function getWatchlistListView(isFuture: boolean): Promise<WatchlistListItem[]> {
  return withSession(async (sessionId) => {
    await evaluateWatchlistPremises(sessionId, isFuture);

    const items = await db
      .select()
      .from(watchlistItems)
      .where(and(eq(watchlistItems.sessionId, sessionId), inArray(watchlistItems.status, ["watching", "bought"])))
      .orderBy(watchlistItems.createdAt);

    if (items.length === 0) return [];

    const theseByItem = await fetchLatestTheses(items.map((i) => i.id));

    return items.map((item) => {
      const thesis = theseByItem.get(item.id);
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
      };
    });
  });
}

/** S1 시세: 목록 쿼리가 돌려준 티커들의 시세만 별도로 조회한다. Map은 서버 액션 경계를 넘기 어려워 객체로 반환한다. */
export async function getWatchlistQuoteMap(
  items: { ticker: string; isSeed: boolean }[],
  isFuture: boolean
): Promise<Record<string, QuoteSnapshot | null>> {
  const quotes = await resolveQuotes(items, isFuture);
  return Object.fromEntries(quotes);
}

export async function fetchLatestTheses(watchlistItemIds: string[]): Promise<Map<string, Thesis>> {
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
export async function resolveQuotes(
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
