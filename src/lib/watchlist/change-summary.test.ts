import { describe, expect, it } from "vitest";
import { nextChangeSummary, type ChangeSummaryMark } from "./change-summary";

describe("nextChangeSummary", () => {
  it("아직 아무것도 말하지 않았고 달라짐이 있으면 말한다", () => {
    expect(nextChangeSummary(null, "current", 2)).toEqual({
      mark: { scenario: "current", count: 2 },
      announce: true,
    });
  });

  it("달라짐이 없으면 말하지 않는다 — 수위는 0으로 잡힌다", () => {
    expect(nextChangeSummary(null, "current", 0)).toEqual({
      mark: { scenario: "current", count: 0 },
      announce: false,
    });
  });

  it("같은 시점에서 개수가 그대로면 말하지 않는다 — S5를 다녀온 왕복이 이 경우다", () => {
    const mark: ChangeSummaryMark = { scenario: "future", count: 4 };
    expect(nextChangeSummary(mark, "future", 4)).toEqual({ mark, announce: false });
  });

  it("같은 시점에서 더 늘어나면 말한다 — 종목을 담고 돌아온 경우", () => {
    expect(nextChangeSummary({ scenario: "current", count: 1 }, "current", 2)).toEqual({
      mark: { scenario: "current", count: 2 },
      announce: true,
    });
  });

  it("개수가 줄어드는 것은 사건이 아니다 — 제외하고 돌아온 자리에서 말하지 않는다", () => {
    const mark: ChangeSummaryMark = { scenario: "future", count: 4 };
    expect(nextChangeSummary(mark, "future", 3)).toEqual({ mark, announce: false });
  });

  it("줄었다 도로 오른 것도 말하지 않는다 — 수위는 최고값에 남는다", () => {
    const dropped = nextChangeSummary({ scenario: "future", count: 4 }, "future", 3);
    expect(nextChangeSummary(dropped.mark, "future", 4).announce).toBe(false);
  });

  it("데모 시점이 바뀌면 수위를 버리고 다시 말한다 — 토글이 데모의 클라이맥스다", () => {
    expect(nextChangeSummary({ scenario: "current", count: 1 }, "future", 4)).toEqual({
      mark: { scenario: "future", count: 4 },
      announce: true,
    });
  });

  it("시점을 껐다 켜면 더 적은 개수라도 다시 말한다", () => {
    const off = nextChangeSummary({ scenario: "future", count: 4 }, "current", 1);
    expect(off.announce).toBe(true);
    expect(nextChangeSummary(off.mark, "future", 4).announce).toBe(true);
  });
});
