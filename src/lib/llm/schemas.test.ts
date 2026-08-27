import { describe, expect, it } from "vitest";
import { findSemanticProblems, findUnavailableMetricPremises } from "./schemas";
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

function valuationPremise(
  metric: "per" | "pbr",
  value: number
): CritiqueRawOutput["premises"][number] {
  return {
    statement: `${metric.toUpperCase()} ${value}배 아래를 유지한다`,
    check_type: "valuation",
    check_config: { kind: "value-ceiling", metric, value, period: null },
  };
}

// #111 회귀 잠금: 이 종목에 오지 않는 지표로 만든 저평가선 전제는 저장되는 순간부터 영구히
// 읽을 수 없음이다. 막지는 않되(막으면 S2 흐름이 죽는다) 아무도 모르는 상태로 두지 않는다.
describe("findUnavailableMetricPremises — 없는 지표를 쓴 저평가선 전제", () => {
  it("지표가 하나도 없으면 valuation 전제를 잡아낸다", () => {
    const found = findUnavailableMetricPremises(output([valuationPremise("per", 15)]), {});
    expect(found).toEqual([{ index: 0, metric: "per", statement: "PER 15배 아래를 유지한다" }]);
  });

  it("지표가 있으면 잡아내지 않는다 — 오탐 없음", () => {
    expect(
      findUnavailableMetricPremises(output([valuationPremise("per", 15)]), { per: 7.53, pbr: 4.56 })
    ).toEqual([]);
  });

  // 판정 단위가 지표 하나라는 것 — PER이 없어도 PBR 전제는 정상이다.
  it("한쪽만 없으면 없는 쪽만 잡아낸다", () => {
    const found = findUnavailableMetricPremises(
      output([valuationPremise("per", 15), valuationPremise("pbr", 0.5)]),
      { pbr: 0.33 }
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ index: 0, metric: "per" });
  });

  it("가격·실적·직접 확인 전제는 지표가 없어도 잡아내지 않는다", () => {
    expect(
      findUnavailableMetricPremises(
        output([
          pricePremise({ kind: "stop-loss", value: 360_900 }),
          { statement: "전제", check_type: "fundamental", check_config: null },
          { statement: "전제", check_type: "qualitative", check_config: null },
        ]),
        {}
      )
    ).toEqual([]);
  });

  // 형식 검증(findSemanticProblems)이 이미 잡는 자리다. 경고까지 겹쳐 내지 않는다.
  it("metric이 비어 있는 valuation 전제는 이 함수의 몫이 아니다", () => {
    expect(
      findUnavailableMetricPremises(
        output([
          {
            statement: "전제",
            check_type: "valuation",
            check_config: { kind: "value-ceiling", metric: null, value: 15, period: null },
          },
        ]),
        {}
      )
    ).toEqual([]);
  });
});
