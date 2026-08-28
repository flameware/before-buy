import type { DemoScenario } from "@/lib/mock/types";

// 변동 요약을 언제 말할 것인가 (#103, #134).
//
// 원래 규칙은 "`달라짐` 개수가 0에서 N으로 올라가는 순간"이었고, 그 `0`은
// `useRef(0)`에 살았다 — **마운트 지역 상태다.** S5로 갔다 오면 홈이 언마운트되어
// 되감기므로, 아무것도 달라지지 않았는데도 돌아올 때마다 규칙이 새로 성립했다.
// 방금 그 종목의 깨진 전제를 들여다보고 나온 사용자에게 "4개 종목에서 달라진 점이
// 있어요"는 새 소식이 아니다.
//
// 그래서 기준을 **이 세션에서 이미 말한 개수**로 옮긴다. 화면을 떠났다 오는 것은
// 이 값을 건드리지 않으므로 왕복은 조용하고, 진짜로 더 늘어났을 때만 다시 말한다.
//
// 최고 수위(high-water)로 재는 이유는 감소를 사건으로 오해하지 않기 위해서다 —
// S5에서 종목을 제외하고 홈으로 돌아오면 개수가 내려가는데, 그 자리에서 "3개
// 종목에서 달라진 점이 있어요"는 방금 한 행동과 무관한 말이다.
//
// **데모 시점이 바뀌면 수위를 버린다.** 토글은 이 데모의 클라이맥스이고(화면명세 S1),
// 시점이 다르면 세어진 대상 자체가 다른 판정이라 이전 수위와 비교할 것이 못 된다.
// 껐다 켜면 매번 다시 뜬다.

/** 이 세션에서 마지막으로 말한 개수와, 그것을 센 데모 시점. */
export type ChangeSummaryMark = { scenario: DemoScenario; count: number };

/**
 * **로딩 프레임을 넘기지 말 것.** 하이드레이션 전에는 `scenario`가 아직 `현재`인데
 * 목록·시세 캐시는 읽히므로, 그 프레임의 개수는 사용자가 보고 있지 않은 시점의 것이다.
 */
export function nextChangeSummary(
  mark: ChangeSummaryMark | null,
  scenario: DemoScenario,
  count: number
): { mark: ChangeSummaryMark; announce: boolean } {
  if (mark === null || mark.scenario !== scenario) {
    return { mark: { scenario, count }, announce: count > 0 };
  }
  if (count > mark.count) return { mark: { scenario, count }, announce: true };
  return { mark, announce: false };
}
