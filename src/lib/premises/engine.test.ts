import { describe, expect, it } from "vitest";
import { hasAutoPremise, parseCheckConfig, resolvePremises } from "./engine";
import type { Premise, QuoteSnapshot } from "@/lib/mock/types";

const QUOTE: QuoteSnapshot = { price: 70_000, changePercent: 1.2, per: 12, pbr: 1.1 };

function premise(overrides: Partial<Premise> = {}): Premise {
  return {
    id: "p1",
    statement: "테스트 전제",
    checkType: "price",
    checkConfig: { operator: "lte", value: 80_000 },
    status: "pending",
    ...overrides,
  };
}

describe("resolvePremises — 자동 확인 전제 (price)", () => {
  it("기준을 만족하면 유지(intact)로 확정하고 관측값을 붙인다", () => {
    const [p] = resolvePremises([premise()], QUOTE);
    expect(p.status).toBe("intact");
    expect(p.observedValue).toBe("70,000원");
  });

  it("기준을 벗어나면 깨짐(broken)으로 확정한다", () => {
    const [p] = resolvePremises([premise({ checkConfig: { operator: "lte", value: 60_000 } })], QUOTE);
    expect(p.status).toBe("broken");
    expect(p.observedValue).toBe("70,000원");
  });

  it("경계값은 만족으로 본다 — lte는 같아도 유지", () => {
    const [p] = resolvePremises([premise({ checkConfig: { operator: "lte", value: 70_000 } })], QUOTE);
    expect(p.status).toBe("intact");
  });

  it("gte도 경계값을 만족으로 본다", () => {
    const [p] = resolvePremises([premise({ checkConfig: { operator: "gte", value: 70_000 } })], QUOTE);
    expect(p.status).toBe("intact");
  });

  // #79/#81 회귀 잠금: 시세가 없으면(조회 중이든 조회 실패든) 판정 불가여야 한다.
  // 저장된 status를 그대로 통과시키면 "달라짐"이어야 할 배지가 "유지 중"으로 보인다.
  it("시세가 없으면 저장된 status를 무시하고 pending으로 되돌린다", () => {
    const [p] = resolvePremises(
      [premise({ status: "broken", observedValue: "90,000원" })],
      null
    );
    expect(p.status).toBe("pending");
    expect(p.observedValue).toBeUndefined();
  });

  it("기준값이 없으면 시세가 있어도 판정하지 않는다", () => {
    const [p] = resolvePremises([premise({ checkConfig: undefined, status: "intact" })], QUOTE);
    expect(p.status).toBe("pending");
  });
});

describe("resolvePremises — 자동 확인 전제 (valuation)", () => {
  function valuation(config: Premise["checkConfig"]): Premise {
    return premise({ checkType: "valuation", checkConfig: config });
  }

  it("PER 기준을 만족하면 유지로 확정하고 배수로 표기한다", () => {
    const [p] = resolvePremises([valuation({ metric: "per", operator: "lte", value: 15 })], QUOTE);
    expect(p.status).toBe("intact");
    expect(p.observedValue).toBe("12.0배");
  });

  it("PBR 기준을 벗어나면 깨짐으로 확정한다", () => {
    const [p] = resolvePremises([valuation({ metric: "pbr", operator: "lte", value: 1 })], QUOTE);
    expect(p.status).toBe("broken");
    expect(p.observedValue).toBe("1.1배");
  });

  it("metric이 없으면 판정하지 않는다", () => {
    const [p] = resolvePremises([valuation({ operator: "lte", value: 15 })], QUOTE);
    expect(p.status).toBe("pending");
  });

  it("시세에 해당 지표가 없으면 판정하지 않는다 — 시드가 아닌 종목은 PER/PBR이 비어 있다", () => {
    const [p] = resolvePremises(
      [valuation({ metric: "per", operator: "lte", value: 15 })],
      { price: 70_000, changePercent: 1.2 }
    );
    expect(p.status).toBe("pending");
  });
});

describe("resolvePremises — 직접 확인 전제", () => {
  it.each(["fundamental", "qualitative"] as const)(
    "%s 전제는 시세가 있어도 저장된 status를 그대로 통과시킨다",
    (checkType) => {
      const stored = premise({ checkType, status: "manual", checkConfig: undefined });
      const [p] = resolvePremises([stored], QUOTE);
      expect(p).toBe(stored);
    }
  );

  it("시세가 없어도 직접 확인 전제는 pending으로 되돌리지 않는다", () => {
    const [p] = resolvePremises([premise({ checkType: "qualitative", status: "broken" })], null);
    expect(p.status).toBe("broken");
  });
});

describe("resolvePremises — 입력 보존", () => {
  it("원본 배열과 원소를 변경하지 않는다", () => {
    const original = premise({ status: "pending" });
    const input = [original];
    resolvePremises(input, QUOTE);
    expect(input).toEqual([original]);
    expect(original.status).toBe("pending");
  });

  it("순서를 유지한 채 자동/직접 확인 전제를 섞어 판정한다", () => {
    const resolved = resolvePremises(
      [
        premise({ id: "a" }),
        premise({ id: "b", checkType: "fundamental", status: "manual", checkConfig: undefined }),
        premise({ id: "c", checkConfig: { operator: "gte", value: 100_000 } }),
      ],
      QUOTE
    );
    expect(resolved.map((p) => [p.id, p.status])).toEqual([
      ["a", "intact"],
      ["b", "manual"],
      ["c", "broken"],
    ]);
  });
});

describe("hasAutoPremise", () => {
  it("price/valuation 전제가 하나라도 있으면 참", () => {
    expect(hasAutoPremise([premise({ checkType: "qualitative" }), premise({ checkType: "valuation" })])).toBe(true);
  });

  it("직접 확인 전제만 있으면 거짓 — 시세와 무관하므로 가릴 이유가 없다", () => {
    expect(
      hasAutoPremise([premise({ checkType: "fundamental" }), premise({ checkType: "qualitative" })])
    ).toBe(false);
  });

  it("전제가 없으면 거짓", () => {
    expect(hasAutoPremise([])).toBe(false);
  });
});

describe("parseCheckConfig", () => {
  it("도메인 타입에 맞는 필드만 남긴다", () => {
    expect(parseCheckConfig({ metric: "per", operator: "lte", value: 15, extra: "무시" })).toEqual({
      metric: "per",
      operator: "lte",
      value: 15,
    });
  });

  it("알 수 없는 값은 버린다", () => {
    expect(parseCheckConfig({ metric: "roe", operator: "eq", value: "15" })).toBeUndefined();
  });

  it.each([[null], [undefined], ["문자열"], [42]])("객체가 아니면 undefined (%s)", (raw) => {
    expect(parseCheckConfig(raw)).toBeUndefined();
  });

  it("일부 필드만 있어도 그 부분은 살린다", () => {
    expect(parseCheckConfig({ operator: "gte", value: 100 })).toEqual({
      metric: undefined,
      operator: "gte",
      value: 100,
    });
  });
});
