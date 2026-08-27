// 관심종목 배지 — **배지 상태(3개)와 시세 상태(3개)를 함께 본다.**
//
// `badgeState`만으로는 화면이 거짓말을 한다. 자동 전제는 시세가 없으면 `pending`이 되는데
// (ADR-0004 — 낡은 판정을 참인 것처럼 보여주느니 판정 불가를 드러낸다), `badgeState`는
// `broken`이 없으면 "유지 중"을 돌려주므로 판정 불가가 전제 수준에서는 드러나고 배지
// 수준에서 사라진다. #79(조회 중)와 #81(조회 실패)이 이 한 자리에서 난 같은 버그다.
//
// **세 번째 축은 시세가 아니다.** 시세가 정상으로 도착해도 전제 쪽이 영구히 판정 불가면
// (`unreadable`) 그 종목은 한 번도 판정된 적이 없는데 `badgeState`는 여전히 "유지 중"을
// 돌려준다(#102). 그래서 판정 불가 갈래는 시세 축 하나가 아니라 둘이며, 둘을 가르는 값은
// 화면이 빈 배지를 무엇 탓으로 설명하느냐를 정한다.
//
// **배지 상태는 여전히 3개다** (CONTEXT.md "배지 상태"). 판정 불가는 네 번째 배지 상태가
// 아니라 배지를 **그릴 수 없는 조건**이며, 그래서 `BadgeState`가 아니라 `BadgeDisplay`의
// 갈래로 표현한다. 호출부가 갈래를 빠뜨릴 수 없게 타입이 강제하는 것이 이 유니온의 목적이다.
//
// mock 배럴이 아니라 전제 판정 엔진 옆에 사는 이유: 배지는 전제 판정의 요약이고, 그 배럴은
// fixture가 사는 자리다. 시세 상태까지 알게 하면 이름과 더 멀어진다.

import { isAutoCheck } from "./engine";
import type { QuoteState } from "@/lib/quote/quote-state";
import type { BadgeState, WatchlistItem } from "@/lib/mock/types";

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

export type BadgeDisplay =
  /** 판정이 확정됐다 — 3상태를 그대로 그린다. */
  | { kind: "badge"; state: BadgeState }
  /** 조회 중 — 아직 시도가 끝나지 않았다. 자리를 skeleton으로 잡아두고 기다린다. */
  | { kind: "pending" }
  /** 조회 실패 — 판정할 수 없다. 기다려도 풀리지 않으므로 그 사정을 화면이 말해야 한다. */
  | { kind: "unknown" }
  /**
   * 판정된 적 없음 — 시세는 정상인데 전제 쪽이 **영구히** 판정 불가(`unreadable`)다.
   * `unknown`과 반드시 갈려 있어야 한다: 이 종목은 시세가 멀쩡히 도착해 현재가가
   * 표시되고 있으므로, 빈 배지를 시세 탓으로 돌리는 문구는 이 자리에서 거짓이 된다(#102).
   */
  | { kind: "unjudged" };

/**
 * 배지 자리에 무엇을 그릴지. 판정 가능 여부를 여기 한 곳에서만 계산한다.
 *
 * **`item`은 지금 그리는 그 시세로 판정된 것이어야 한다** (`composeView`) — 전제의
 * `status`를 시세 상태와 함께 읽기 때문이다. ADR-0004의 불변식이 여기서도 전제다.
 *
 * 갈래 사이 우선순위는 아래 순서대로이며, 각 단계의 문구가 **그 시점에 참**이어야 한다는
 * 것이 순서를 정한 이유다:
 *
 * 1. 근거가 없으면 시세·`unreadable`과 무관하게 **근거 없음**이다.
 * 2. `broken`이 하나라도 있으면 시세·`unreadable`과 무관하게 **달라짐**이다. "달라짐"은
 *    하나만 깨져도 참인 명제라 나머지를 판정하지 못해도 이미 확정이며, 이를 판정 불가로
 *    감추는 것은 #81의 거울상이다.
 * 3. 시세를 기다리는 자동 전제(`pending`)가 있고 시세가 결판나지 않았으면 **시세 축**이다.
 * 4. 시세와 무관하게 풀리지 않는 자동 전제(`unreadable`)가 있으면 **판정된 적 없음**이다.
 * 5. 나머지는 배지 3상태.
 *
 * 3이 4보다 앞서는 이유: 시세 축은 재시도로 풀릴 수 있고, 풀린 뒤에도 `unreadable`은
 * 그대로 남아 그때 4로 넘어간다. 순서가 뒤집히면 재시도로 풀릴 일을 영구 판정 불가처럼
 * 말하게 된다.
 *
 * `pending`이 아니라 **자동 전제의 존재**로 시세 축을 물으면, 시세가 와도 풀리지 않는
 * 전제(`unreadable`)뿐인 종목까지 "시세를 불러오지 못해"라고 말하게 된다 — 시세는 그
 * 종목이 판정되지 않는 이유가 아니다. 자동 전제가 없는 종목(직접 확인 전제만)은 판정이
 * 시세에 달려 있지 않아 두 축 모두를 비껴가며 확정이다.
 */
export function badgeDisplay(item: WatchlistItem, quote: QuoteState): BadgeDisplay {
  const state = badgeState(item);
  if (state !== "intact" || !item.thesis) return { kind: "badge", state };

  const autoPremises = item.thesis.premises.filter((p) => isAutoCheck(p.checkType));
  const waitingOnQuote = autoPremises.some((p) => p.status === "pending");
  if (waitingOnQuote && quote.state === "loading") return { kind: "pending" };
  if (waitingOnQuote && quote.state === "failed") return { kind: "unknown" };
  if (autoPremises.some((p) => p.status === "unreadable")) return { kind: "unjudged" };
  return { kind: "badge", state };
}

/**
 * S1 헤더가 세는 세 수. 한 번 순회해 셋 다 세는 이유는 **같은 판정에서 나와야** 하기
 * 때문이다 — 따로 세면 "달라짐 N개"와 "확인 불가 M개"가 서로 다른 기준으로 계산될 수 있고,
 * 그 어긋남은 화면에서 조용히 사라진다(#81에서 배너가 통째로 사라졌던 것처럼).
 *
 * `unknown`(시세를 불러오지 못함)과 `unjudged`(시스템이 판정할 수 없는 근거)는 **따로**
 * 센다. 합산하면 헤더 한 문장이 두 원인을 뭉뚱그리게 되고, 그 문장은 둘 중 한쪽 종목에는
 * 반드시 거짓이 된다(#102).
 */
export function countByJudgment(items: (WatchlistItem & { quote: QuoteState })[]): {
  changed: number;
  unknown: number;
  unjudged: number;
} {
  let changed = 0;
  let unknown = 0;
  let unjudged = 0;
  for (const item of items) {
    const display = badgeDisplay(item, item.quote);
    if (display.kind === "unknown") unknown++;
    else if (display.kind === "unjudged") unjudged++;
    else if (display.kind === "badge" && display.state === "changed") changed++;
  }
  return { changed, unknown, unjudged };
}
