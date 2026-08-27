import { describe, expect, it } from "vitest";
import { QUOTE_FAILED, QUOTE_LOADING, settledQuote, snapshotOf } from "./quote-state";
import type { QuoteSnapshot } from "@/lib/mock/types";

const SNAPSHOT: QuoteSnapshot = { price: 70_000, changePercent: 1.2 };

describe("settledQuote", () => {
  it("값이 있으면 조회 완료로 올린다", () => {
    expect(settledQuote(SNAPSHOT)).toEqual({ state: "ok", snapshot: SNAPSHOT });
  });

  // 서버 경계에서 `null`은 순수하게 조회 실패다 — "조회 중"은 여기서 나오지 않는다.
  it.each([[null], [undefined]])("값이 없으면 조회 실패다 (%s) — 조회 중이 아니다", (quote) => {
    expect(settledQuote(quote)).toEqual(QUOTE_FAILED);
  });
});

describe("snapshotOf", () => {
  it("조회 완료면 스냅샷을 꺼낸다", () => {
    expect(snapshotOf({ state: "ok", snapshot: SNAPSHOT })).toBe(SNAPSHOT);
  });

  it.each([
    ["조회 중", QUOTE_LOADING],
    ["조회 실패", QUOTE_FAILED],
  ])("%s는 둘 다 null — 판정 함수는 그 차이를 구분할 이유가 없다", (_label, state) => {
    expect(snapshotOf(state)).toBeNull();
  });
});
