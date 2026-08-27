import { describe, expect, it } from "vitest";
import { badgeDisplay, badgeLabel, badgeState, countByJudgment } from "./badge";
import { QUOTE_FAILED, QUOTE_LOADING, type QuoteState } from "@/lib/quote/quote-state";
import type { BadgeState, Premise, QuoteSnapshot, Thesis, WatchlistItem } from "@/lib/mock/types";

function premise(status: Premise["status"], checkType: Premise["checkType"] = "price"): Premise {
  return { id: `p-${checkType}-${status}`, statement: "전제", checkType, status };
}

/** 직접 확인 전제 — 판정이 시세에 달려 있지 않다. */
function manualPremise(status: Premise["status"] = "manual"): Premise {
  return premise(status, "qualitative");
}

function thesis(premises: Premise[]): Thesis {
  return {
    category: "undervalued",
    followup: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    critique: { isChallengeable: false, counterpoints: [], openQuestions: [] },
    premises,
  };
}

function item(overrides: Partial<WatchlistItem> = {}): WatchlistItem {
  return {
    id: "w1",
    ticker: "005930",
    status: "watching",
    isSeed: true,
    addedPrice: 65_000,
    addedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const snapshot: QuoteSnapshot = { price: 70_000, changePercent: 1.2 };
const QUOTE_OK: QuoteState = { state: "ok", snapshot };

describe("badgeState", () => {
  it("근거가 없으면 근거 없음", () => {
    expect(badgeState(item())).toBe("no-thesis");
  });

  it("깨진 전제가 하나라도 있으면 달라짐", () => {
    expect(badgeState(item({ thesis: thesis([premise("intact"), premise("broken")]) }))).toBe("changed");
  });

  it("전제가 모두 유효하면 유지 중", () => {
    expect(badgeState(item({ thesis: thesis([premise("intact"), premise("manual")]) }))).toBe("intact");
  });

  // #85 회귀 잠금: 도달 목표는 배지에 투표하지 않는다. 목표가에 아직 닿지 않은 것은
  // 생각이 틀어진 게 아니라 진행 중인 것이라 "달라짐"이 될 수 없고, 닿은 것도 마찬가지다.
  // 이 보장은 `badgeState`의 필터가 아니라 **상태 어휘가 갈려 있다는 사실**에서 나온다 —
  // 도달 목표는 `broken`을 낼 수 없다(engine.ts의 `judge`).
  it.each(["awaiting", "reached"] as const)("도달 목표(%s)는 달라짐을 만들지 않는다", (status) => {
    expect(badgeState(item({ thesis: thesis([premise("intact"), premise(status)]) }))).toBe("intact");
  });

  it("전제가 비어 있어도 근거가 있으면 유지 중", () => {
    expect(badgeState(item({ thesis: thesis([]) }))).toBe("intact");
  });
});

describe("badgeLabel", () => {
  it.each([
    ["no-thesis", "근거 없음"],
    ["intact", "유지 중"],
    ["changed", "달라짐"],
  ] as [BadgeState, string][])("%s → %s", (state, label) => {
    expect(badgeLabel(state)).toBe(label);
  });
});

// `badgeDisplay`는 **지금 그리는 그 시세로 판정된** 항목을 받는다(`composeView`) —
// 시세가 없으면 설정을 읽을 수 있는 자동 전제는 `pending`, 못 읽는 것은 `unreadable`이다.
describe("badgeDisplay", () => {
  it("시세가 오면 3상태를 그대로 그린다", () => {
    const judged = item({ thesis: thesis([premise("intact")]) });
    expect(badgeDisplay(judged, QUOTE_OK)).toEqual({ kind: "badge", state: "intact" });
  });

  // #79: 조회 중에는 자동 전제가 전부 pending이라 "유지 중"으로 계산된다 — 곧 "달라짐"이
  // 될 자리에 확신을 보여주지 않도록 배지를 가린다.
  it("조회 중 + 시세를 기다리는 자동 전제 → skeleton", () => {
    const waiting = item({ thesis: thesis([premise("pending")]) });
    expect(badgeDisplay(waiting, QUOTE_LOADING)).toEqual({ kind: "pending" });
  });

  // #81: 같은 자리의 실패 축. 기다려도 풀리지 않을 뿐 판정 불가인 것은 같다.
  it("조회 실패 + 시세를 기다리는 자동 전제 → 판정 불가", () => {
    const waiting = item({ thesis: thesis([premise("pending")]) });
    expect(badgeDisplay(waiting, QUOTE_FAILED)).toEqual({ kind: "unknown" });
  });

  // "달라짐"은 하나만 깨져도 참인 명제라 나머지를 판정하지 못해도 이미 확정이다.
  // 이걸 판정 불가로 감추는 것은 #81 버그의 거울상이다.
  it.each([
    ["조회 실패", QUOTE_FAILED],
    ["조회 중", QUOTE_LOADING],
  ] as [string, QuoteState][])("깨진 전제가 있으면 %s여도 달라짐", (_label, quote) => {
    const broken = item({ thesis: thesis([premise("broken"), premise("pending")]) });
    expect(badgeDisplay(broken, quote)).toEqual({ kind: "badge", state: "changed" });
  });

  it.each([
    ["조회 실패", QUOTE_FAILED],
    ["조회 중", QUOTE_LOADING],
  ] as [string, QuoteState][])("자동 전제가 없으면 %s여도 배지를 그대로 그린다", (_label, quote) => {
    const manualOnly = item({ thesis: thesis([manualPremise(), manualPremise("pending")]) });
    expect(badgeDisplay(manualOnly, quote)).toEqual({ kind: "badge", state: "intact" });
  });

  // 시세가 와도 풀리지 않는 전제(`unreadable`)뿐인 종목에 "시세를 불러오지 못해"라고
  // 말하면, 시세가 돌아오는 순간 배지가 "유지 중"으로 바뀌며 앞말이 거짓이 된다.
  // 시세는 이 종목이 판정되지 않는 이유가 아니다.
  it("읽을 수 없는 자동 전제뿐이면 조회 실패여도 배지를 그대로 그린다", () => {
    const unreadable = item({ thesis: thesis([premise("unreadable")]) });
    expect(badgeDisplay(unreadable, QUOTE_FAILED)).toEqual({ kind: "badge", state: "intact" });
  });

  it.each([
    ["조회 실패", QUOTE_FAILED],
    ["조회 중", QUOTE_LOADING],
  ] as [string, QuoteState][])("근거가 없으면 %s여도 근거 없음", (_label, quote) => {
    expect(badgeDisplay(item(), quote)).toEqual({ kind: "badge", state: "no-thesis" });
  });

  it("전제가 비어 있으면 시세와 무관하게 유지 중", () => {
    expect(badgeDisplay(item({ thesis: thesis([]) }), QUOTE_FAILED)).toEqual({
      kind: "badge",
      state: "intact",
    });
  });
});

describe("countByJudgment", () => {
  const withQuote = (overrides: Partial<WatchlistItem>, quote: QuoteState) => ({
    ...item(overrides),
    quote,
  });

  it("달라짐과 판정 불가를 한 번에 센다", () => {
    const items = [
      withQuote({ id: "a", thesis: thesis([premise("broken")]) }, QUOTE_OK),
      withQuote({ id: "b", thesis: thesis([premise("broken"), premise("pending")]) }, QUOTE_FAILED),
      withQuote({ id: "c", thesis: thesis([premise("pending")]) }, QUOTE_FAILED),
      withQuote({ id: "d", thesis: thesis([premise("intact")]) }, QUOTE_OK),
      withQuote({ id: "e" }, QUOTE_FAILED),
    ];
    expect(countByJudgment(items)).toEqual({ changed: 2, unknown: 1 });
  });

  // 조회 중은 판정 불가가 아니다 — 아직 시도가 끝나지 않았으므로 헤더가 그 수를
  // 말하기 시작하면 시세가 오는 순간 사라질 문장을 보여주게 된다.
  it("조회 중은 어느 쪽에도 세지 않는다", () => {
    const items = [withQuote({ id: "a", thesis: thesis([premise("pending")]) }, QUOTE_LOADING)];
    expect(countByJudgment(items)).toEqual({ changed: 0, unknown: 0 });
  });

  it("빈 목록은 둘 다 0", () => {
    expect(countByJudgment([])).toEqual({ changed: 0, unknown: 0 });
  });
});
