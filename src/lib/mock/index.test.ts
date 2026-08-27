import { describe, expect, it } from "vitest";
import { badgeLabel, badgeState, changedCount, splitByStatus } from "./index";
import type { BadgeState, Premise, Thesis, WatchlistItem } from "./types";

function premise(status: Premise["status"]): Premise {
  return { id: `p-${status}`, statement: "전제", checkType: "price", status };
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

  // 아래는 **현 동작의 기록이지 옳다는 승인이 아니다.** `pending`(판정 불가)을
  // "유지 중"으로 접는 것이 #79/#81이 난 자리다 — 이 함수는 시세 상태를 보지 않아
  // "깨지지 않음"과 "유효함"을 구분하지 못한다. #81이 `badgeDisplay`로 그 판단을 모으면
  // 이 테스트는 의도대로 빨개진다. 그때 지우고 조합 테이블로 갈아끼울 것.
  it("[#81이 뒤집을 현 동작] pending 전제만 있어도 유지 중을 돌려준다", () => {
    expect(badgeState(item({ thesis: thesis([premise("pending")]) }))).toBe("intact");
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

describe("changedCount", () => {
  it("달라짐 종목만 센다", () => {
    const items = [
      item({ id: "a", thesis: thesis([premise("broken")]) }),
      item({ id: "b", thesis: thesis([premise("intact")]) }),
      item({ id: "c" }),
      item({ id: "d", thesis: thesis([premise("intact"), premise("broken")]) }),
    ];
    expect(changedCount(items)).toBe(2);
  });

  it("빈 목록은 0", () => {
    expect(changedCount([])).toBe(0);
  });
});

describe("splitByStatus", () => {
  it("관심종목과 보유중을 가른다", () => {
    const watching = item({ id: "a", status: "watching" });
    const bought = item({ id: "b", status: "bought" });
    const removed = item({ id: "c", status: "removed" });
    expect(splitByStatus([watching, bought, removed])).toEqual({
      watching: [watching],
      bought: [bought],
    });
  });
});
