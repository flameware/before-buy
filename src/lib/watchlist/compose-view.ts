import { resolvePremises } from "@/lib/premises/engine";
import { snapshotOf, type QuoteState } from "@/lib/quote/quote-state";
import type { WatchlistListItem, WatchlistViewItem } from "@/lib/watchlist/get-watchlist";

/**
 * ADR-0004의 불변식이 사는 곳: **배지는 화면에 그리는 바로 그 시세에서 나온다.**
 * 목록(시점과 무관한 DB 사실)과 시세를 만나게 하는 자리가 여기 하나뿐이어야, 가격만
 * 바뀌고 배지가 과거에 남는 일이 구조적으로 불가능해진다. 화면마다 이 합성을 다시 쓰면
 * 그 불변식도 화면 수만큼 복제된다 — 이미 한 번 버그로 드러난 지점이다.
 *
 * `use-watchlist-view.ts`가 아니라 이 파일에 사는 이유: 그 훅은 Server Action을 임포트해
 * 서버 전용 모듈을 끌고 오므로 단위 테스트에서 임포트할 수 없다 (#78).
 */
export function composeView(item: WatchlistListItem, quote: QuoteState): WatchlistViewItem {
  return {
    ...item,
    quote,
    thesis: item.thesis
      ? { ...item.thesis, premises: resolvePremises(item.thesis.premises, snapshotOf(quote)) }
      : undefined,
  };
}
