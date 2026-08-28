// 이 마운트에서 시작한 조회가 끝났는가 (#141).
//
// `!isFetching`은 "조회가 끝났다"가 아니라 "지금 조회 중이 아니다"이고, 둘은 **조회가
// 아직 시작조차 하지 않았을 때** 갈라진다. 그 창구는 두 번 열린다 —
//
//   1. `enabled: false`인 동안 (하이드레이션 전에는 데모 시점을 아직 모른다)
//   2. `enabled`가 참이 된 첫 렌더 (`refetchOnMount`의 발화는 이펙트라 한 렌더 늦는다)
//
// 그 프레임들에서 React Query는 **이전 키의 캐시 데이터를 그대로 돌려준다.** 그래서
// `!isFetching`을 "재검증됨"으로 읽으면, S4가 직전 데모 시점(`현재`)의 캐시 시세에
// 영원히 고정된다 — 가격도 전제 배지도 함께 틀린다(ADR-0004는 둘을 같은 스냅샷에서
// 뽑으므로). ADR-0005가 `settled`를 도입하며 막으려던 바로 그 일이다.
//
// 그래서 시점(`isFetching`의 순간값)이 아니라 **전이**를 본다: 조회가 한 번 시작해서
// 끝났는가. 상태 하나로 접히고, 순수 함수라 경계를 테스트로 못박을 수 있다.

/**
 * `idle` — 이 마운트에서 조회가 아직 시작하지 않았다. 손에 있는 값은 캐시된 과거다.
 * `fetching` — 시작했다. `settled` — 끝났다(성공이든 실패든). 한 번 닿으면 돌아오지 않는다.
 */
export type FetchPhase = "idle" | "fetching" | "settled";

export const INITIAL_FETCH_PHASE: FetchPhase = "idle";

/**
 * 성공과 실패를 가르지 않는다. 이 값이 답하는 질문은 "이 값이 재검증을 거쳤는가"이고,
 * 실패한 재검증도 **거친 것**이다 — 시도가 끝났는데도 계속 기다리는 척하면 시트는
 * 영영 고정되지 않는다. 실패했을 때 무엇을 보여줄지는 `quoteStateFor`가 따로 정한다.
 */
export function nextFetchPhase(phase: FetchPhase, isFetching: boolean): FetchPhase {
  if (phase === "settled") return "settled";
  if (phase === "fetching") return isFetching ? "fetching" : "settled";
  return isFetching ? "fetching" : "idle";
}
