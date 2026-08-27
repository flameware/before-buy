import type { BadgeState, WatchlistItem } from "./types";

export * from "./types";
export * from "./categories";
export { DEMO_WHITELIST, POPULAR_TICKERS, findDemoStock, popularStocks } from "./demo-whitelist";
export { setThesisDraft, getThesisDraft, type ThesisDraft } from "./thesis-draft";
export { addUserWatchlistItem, removeWatchlistItem } from "./user-watchlist";
export { generateCritique, generatePremises } from "./critique";

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

export function splitByStatus<T extends WatchlistItem>(items: T[]) {
  return {
    watching: items.filter((i) => i.status === "watching"),
    bought: items.filter((i) => i.status === "bought"),
  };
}

export function changedCount(items: WatchlistItem[]): number {
  return items.filter((i) => badgeState(i) === "changed").length;
}
