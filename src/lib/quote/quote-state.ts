// 시세 상태 — 화면이 보는 시세의 세 상태.
//
// 이 파일이 생긴 이유: 예전에는 화면까지 오는 시세가 `QuoteSnapshot | null` 두 상태뿐이라
// **조회 전**과 **조회 실패**를 구분할 수 없었다. S1은 아직 오지 않은 시세를 "시세 조회
// 실패"로 그렸고, 같은 `null`이 `resolvePremises`로 흘러 자동 전제가 전부 `pending`이 되는
// 바람에 "달라짐"이어야 할 배지가 1~2초간 "유지 중"으로 보였다.
//
// **`loading`은 클라이언트 캐시 계층에만 존재한다.** 서버 조회는 언제나 결판난 시세를
// 돌려주므로(`SettledWatchlistItem.quote`), 서버 경계 타입은 `QuoteSnapshot | null`로
// 남겨두고 — 거기서 `null`은 순수하게 조회 실패다 — 이 유니온은 화면용 타입에만 쓴다.

import type { QuoteSnapshot } from "@/lib/mock/types";

export type QuoteState =
  /** 조회 중: 아직 시도의 결과가 없다. 가격도 전제 판정도 보여줄 수 없다. */
  | { state: "loading" }
  /** 조회 실패: 시도했고 값을 얻지 못했다. 쿼리 전체 실패와 종목별 실패를 함께 접는다. */
  | { state: "failed" }
  | { state: "ok"; snapshot: QuoteSnapshot };

export const QUOTE_LOADING: QuoteState = { state: "loading" };
export const QUOTE_FAILED: QuoteState = { state: "failed" };

/** 결판난 서버 값(`null` = 실패)을 화면용 3상태로 올린다. `loading`은 여기서 나오지 않는다. */
export function settledQuote(quote: QuoteSnapshot | null | undefined): QuoteState {
  return quote ? { state: "ok", snapshot: quote } : QUOTE_FAILED;
}

/**
 * 전제 판정에 넘길 시세. `loading`과 `failed` 모두 `null`이 된다 — 판정 함수는 "아직
 * 안 왔음"과 "못 가져왔음"을 구분할 이유가 없고(둘 다 판정 불가), 그 차이를 화면에서
 * 어떻게 보일지만 다르다(ADR-0004).
 */
export function snapshotOf(state: QuoteState): QuoteSnapshot | null {
  return state.state === "ok" ? state.snapshot : null;
}
