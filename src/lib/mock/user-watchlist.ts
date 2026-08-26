import type { WatchlistItem } from "./types";

/**
 * S2→S3에서 "이대로 담기"로 새로 담은 종목. 모듈 스코프 인메모리 상태 —
 * thesis-draft.ts와 같은 이유로 세션 내 라우팅 간에는 유지되고 새로고침하면 휘발된다.
 */
const userItems: WatchlistItem[] = [];

/** S5 "관심종목에서 제외" — 시각적 반영만(Notes: 실제 기록 없음), id로 목록에서 숨김. */
const removedIds = new Set<string>();

export function addUserWatchlistItem(item: WatchlistItem): void {
  userItems.push(item);
}

export function getUserWatchlistItems(): WatchlistItem[] {
  return userItems.filter((item) => !removedIds.has(item.id));
}

export function removeWatchlistItem(id: string): void {
  removedIds.add(id);
}

export function isWatchlistItemRemoved(id: string): boolean {
  return removedIds.has(id);
}
