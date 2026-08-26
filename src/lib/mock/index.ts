import { findStock, STATIC_QUOTES } from "./stock-universe";
import { resolveSeedItems, resolveSeedQuote } from "./seed-data";
import type { BadgeState, QuoteSnapshot, Stock, WatchlistItem } from "./types";

export * from "./types";
export * from "./categories";
export { STOCK_UNIVERSE, POPULAR_TICKERS, findStock, searchStocks } from "./stock-universe";
export { setThesisDraft, getThesisDraft, type ThesisDraft } from "./thesis-draft";

/** 근거 없음 / 유지 중 / 달라짐. CONTEXT.md "배지 상태" — 정확히 이 3개뿐. */
export function badgeState(item: WatchlistItem): BadgeState {
  if (!item.thesis) return "no-thesis";
  const hasBroken = item.thesis.premises.some((p) => p.status === "broken");
  return hasBroken ? "changed" : "intact";
}

export function badgeLabel(state: BadgeState): string {
  switch (state) {
    case "no-thesis":
      return "근거 없음";
    case "intact":
      return "유지 중";
    case "changed":
      return "달라짐";
  }
}

/** 시드 종목이면 시나리오별 시세를, 사용자가 담은 종목이면 정적 fixture 시세를 반환. */
export function quoteFor(item: Pick<WatchlistItem, "ticker" | "isSeed">, isFuture: boolean): QuoteSnapshot {
  if (item.isSeed) {
    const seedQuote = resolveSeedQuote(item.ticker, isFuture);
    if (seedQuote) return seedQuote;
  }
  return STATIC_QUOTES[item.ticker] ?? { price: 0, changePercent: 0 };
}

export function stockFor(item: Pick<WatchlistItem, "ticker">): Stock {
  const stock = findStock(item.ticker);
  if (!stock) throw new Error(`Unknown ticker in mock data: ${item.ticker}`);
  return stock;
}

/**
 * 인메모리 관심종목 목록. 시드 3종으로 시작하고, 세션 중 사용자가 담은 종목이
 * (React state를 통해) 여기 이어붙는다 — 새로고침 시 시드로 리셋되는 건 의도된 동작
 * (Notes: "S2에서 담은 종목은 새로고침 시 휘발되어도 무방").
 */
export function initialWatchlist(isFuture: boolean): WatchlistItem[] {
  return resolveSeedItems(isFuture);
}

export function splitByStatus(items: WatchlistItem[]) {
  return {
    watching: items.filter((i) => i.status === "watching"),
    bought: items.filter((i) => i.status === "bought"),
  };
}

export function changedCount(items: WatchlistItem[]): number {
  return items.filter((i) => badgeState(i) === "changed").length;
}
