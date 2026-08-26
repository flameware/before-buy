import type { WatchlistItem } from "./types";

/**
 * S2→S3에서 "이대로 담기"로 새로 담은 종목. 모듈 스코프 인메모리 상태 —
 * thesis-draft.ts와 같은 이유로 세션 내 라우팅 간에는 유지되고 새로고침하면 휘발된다.
 */
const userItems: WatchlistItem[] = [];

export function addUserWatchlistItem(item: WatchlistItem): void {
  userItems.push(item);
}

export function getUserWatchlistItems(): WatchlistItem[] {
  return userItems;
}
