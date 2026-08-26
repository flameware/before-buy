"use server";

import { getWatchlistView, type WatchlistViewItem } from "@/lib/watchlist/get-watchlist";

/** S1이 클라이언트에서 "3개월 후" 토글이 바뀔 때마다 호출하는 Server Action. */
export async function loadWatchlist(isFuture: boolean): Promise<WatchlistViewItem[]> {
  return getWatchlistView(isFuture);
}
