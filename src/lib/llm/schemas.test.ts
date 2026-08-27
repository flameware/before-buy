import { describe, expect, it } from "vitest";
import { findSemanticProblems } from "./schemas";
import type { CritiqueRawOutput } from "./schemas";

const ANCHOR = 401_000;

function output(premises: CritiqueRawOutput["premises"]): CritiqueRawOutput {
  return {
    is_challengeable: false,
    challenge_reason: "",
    counterpoints: [],
    open_questions: [],
    premises,
  };
}

function pricePremise(
  config: Partial<NonNullable<CritiqueRawOutput["premises"][number]["check_config"]>>
): CritiqueRawOutput["premises"][number] {
  return {
    statement: "전제",
    check_type: "price",
    check_config: { kind: null, metric: null, value: null, period: null, ...config },
  };
}

describe("findSemanticProblems — 가격 기준선의 방향", () => {
  // #85 회귀 잠금: 이 검사가 없어서 "손절선인데 담은 날 가격보다 높은 값"이 통과했고,
  // 그 결과 담은 날부터 깨진 전제가 화면에 떴다.
  it("담은 날 가격보다 높은 손절선을 잡아낸다", () => {
    const problems = findSemanticProblems(
      output([pricePremise({ kind: "stop-loss", value: 440_000 })]),
      ANCHOR
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("손절선");
  });

  it("담은 날 가격보다 낮은 목표가를 잡아낸다", () => {
    const problems = findSemanticProblems(
      output([pricePremise({ kind: "target-price", value: 360_900 })]),
      ANCHOR
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("목표가");
  });

  it("올바른 방향은 통과시킨다", () => {
    expect(
      findSemanticProblems(
        output([
          pricePremise({ kind: "stop-loss", value: 360_900 }),
          pricePremise({ kind: "target-price", value: 450_000 }),
        ]),
        ANCHOR
      )
    ).toEqual([]);
  });

  // 사용자가 현재가를 그대로 손절선이나 목표가로 답하는 것은 정상적인 답이다.
  it.each(["stop-loss", "target-price", "value-ceiling"] as const)(
    "경계값(담은 날 가격과 같은 값)은 허용한다 — %s",
    (kind) => {
      expect(
        findSemanticProblems(output([pricePremise({ kind, value: ANCHOR })]), ANCHOR)
      ).toEqual([]);
    }
  );
});

describe("findSemanticProblems — check_type과 kind의 정합", () => {
  it("kind가 없으면 잡아낸다", () => {
    const problems = findSemanticProblems(output([pricePremise({ value: 100 })]), ANCHOR);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("kind");
  });

  it("valuation 전제에 목표가 kind가 오면 잡아낸다", () => {
    const problems = findSemanticProblems(
      output([
        {
          statement: "전제",
          check_type: "valuation",
          check_config: { kind: "target-price", metric: "per", value: 15, period: null },
        },
      ]),
      ANCHOR
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("value-ceiling");
  });

  it("valuation 전제에 metric이 없으면 잡아낸다", () => {
    const problems = findSemanticProblems(
      output([
        {
          statement: "전제",
          check_type: "valuation",
          check_config: { kind: "value-ceiling", metric: null, value: 15, period: null },
        },
      ]),
      ANCHOR
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("metric");
  });

  it("price 전제에 metric이 오면 잡아낸다 — 가격에는 지표가 없다", () => {
    const problems = findSemanticProblems(
      output([pricePremise({ kind: "stop-loss", metric: "per", value: 360_900 })]),
      ANCHOR
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("metric");
  });

  it("직접 확인 전제는 check_config 없이 통과한다", () => {
    expect(
      findSemanticProblems(
        output([{ statement: "전제", check_type: "qualitative", check_config: null }]),
        ANCHOR
      )
    ).toEqual([]);
  });
});
