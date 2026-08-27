import type { WatchlistItem } from "./types";

export * from "./types";
export * from "./categories";
export { DEMO_WHITELIST, POPULAR_TICKERS, findDemoStock, popularStocks } from "./demo-whitelist";
export { setThesisDraft, getThesisDraft, type ThesisDraft } from "./thesis-draft";
export { addUserWatchlistItem, removeWatchlistItem } from "./user-watchlist";
export { generateCritique, generatePremises } from "./critique";

export function splitByStatus<T extends WatchlistItem>(items: T[]) {
  return {
    watching: items.filter((i) => i.status === "watching"),
    bought: items.filter((i) => i.status === "bought"),
  };
}
