// S1 관심종목 목록의 실 데이터 조회 (지도 #38 destination). 세션 소유 watchlist_items를
// DB에서 읽어 반환한다. Server Action(actions.ts)이 이 함수를 감싼다.
//
// ADR-0002: 목록(DB: 종목/근거/전제)과 시세(KIS)는 클라이언트에서 서로 다른 캐시
// 수명으로 다뤄야 해서 두 개의 독립된 조회로 분리했다 — getWatchlistListView가
// 목록을, resolveQuotes(quote 부분만 필요한 곳에서 별도 호출)가 시세를 맡는다.
//
// ADR-0004: 목록 조회는 **데모 시점을 받지 않는다.** 자동 전제의 status는 저장하지 않고
// 시세와 만나는 자리에서 계산하므로(`resolvePremises`), 목록이 돌려주는 것은 시점과
// 무관한 DB 사실 — 종목/근거/기준값(`checkConfig`)과 직접 확인 전제의 status — 뿐이다.
// 시점에 의존하는 것은 시세뿐이고, S1은 화면에 그리는 그 시세로 배지를 계산한다.

import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { critiques, premises, theses, watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";
import { parseCheckConfig } from "@/lib/premises/engine";
import { getKoreanStockPrices } from "@/lib/kis/batch-quote";
import { resolveSeedQuote } from "@/lib/mock/seed-data";
import type { Critique, DemoScenario, FollowupAnswer, Premise, QuoteSnapshot, Thesis, WatchlistItem } from "@/lib/mock/types";
import type { QuoteState } from "@/lib/quote/quote-state";

/** 시세를 아직 붙이지 않은 목록 항목 — S1이 목록 쿼리와 시세 쿼리를 분리 캐싱하는 데 쓴다. */
export interface WatchlistListItem extends WatchlistItem {
  name: string;
}

/**
 * 서버가 돌려주는 1건 — 시세는 이미 결판나 있다. 여기서 `null`은 **조회 실패**만
 * 뜻한다. 서버에는 "조회 중"이 존재하지 않으므로 3상태 유니온을 쓰지 않는다.
 */
export interface SettledWatchlistItem extends WatchlistListItem {
  quote: QuoteSnapshot | null;
}

/**
 * 화면이 보는 항목. 시세는 조회 중/실패/완료 3상태다 — 목록과 시세를 따로 캐싱하는
 * (ADR-0002) 클라이언트에서만 "조회 중"이라는 중간 상태가 생긴다.
 */
export interface WatchlistViewItem extends WatchlistListItem {
  quote: QuoteState;
}

/**
 * S1 목록(DB 부분만): 화면에 보이는(watching/bought) 종목의 근거/전제를 조회한다.
 * 시세도, 데모 시점도 받지 않는다 — 자동 전제의 status는 호출부가 시세와 함께
 * `resolvePremises`로 확정한다(ADR-0004).
 */
export async function getWatchlistListView(): Promise<WatchlistListItem[]> {
  return withSession(async (sessionId) => {
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
  scenario: DemoScenario
): Promise<Record<string, QuoteSnapshot | null>> {
  const quotes = await resolveQuotes(items, scenario);
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
      checkConfig: parseCheckConfig(p.checkConfig),
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
 * 시드 종목도 `현재` 시점에는 그 외 종목과 동일하게 KIS 실전 도메인 배치 조회 결과를
 * 쓴다. `3개월 후`일 때만 시드 종목에 한해 fixture 시세를 참조한다. 개별 종목 조회
 * 실패는 `null`로 표시해 화면이 폴백을 그리게 한다.
 */
export async function resolveQuotes(
  items: { ticker: string; isSeed: boolean }[],
  scenario: DemoScenario
): Promise<Map<string, QuoteSnapshot | null>> {
  const quotes = new Map<string, QuoteSnapshot | null>();
  const isFuture = scenario === "future";

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
