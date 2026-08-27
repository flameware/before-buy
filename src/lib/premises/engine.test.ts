import { describe, expect, it } from "vitest";
import { hasAutoPremise, parseCheckConfig, resolvePremises } from "./engine";
import type { Premise, QuoteSnapshot } from "@/lib/mock/types";

const QUOTE: QuoteSnapshot = { price: 70_000, changePercent: 1.2, per: 12, pbr: 1.1 };

function premise(overrides: Partial<Premise> = {}): Premise {
  return {
    id: "p1",
    statement: "테스트 전제",
    checkType: "price",
    checkConfig: { kind: "value-ceiling", value: 80_000 },
    status: "pending",
    ...overrides,
  };
}

describe("resolvePremises — 유지 조건 (price)", () => {
  it("가격 상한 아래면 유지(intact)로 확정하고 관측값을 붙인다", () => {
    const [p] = resolvePremises([premise()], QUOTE);
    expect(p.status).toBe("intact");
    expect(p.observedValue).toBe("70,000원");
  });

  it("가격 상한을 넘으면 깨짐(broken)으로 확정한다", () => {
    const [p] = resolvePremises([premise({ checkConfig: { kind: "value-ceiling", value: 60_000 } })], QUOTE);
    expect(p.status).toBe("broken");
    expect(p.observedValue).toBe("70,000원");
  });

  // #85 회귀 잠금: 손절선은 가격이 그 **아래**로 내려갈 때만 깨진다. 방향을 기록하는 쪽이
  // 고르던 시절, 손절선 위에 있는 종목이 "달라짐"으로 뜨는 버그가 여기서 났다.
  it("손절선 위에 있으면 유지다 — 하한을 상한처럼 읽지 않는다", () => {
    const [p] = resolvePremises([premise({ checkConfig: { kind: "stop-loss", value: 63_000 } })], QUOTE);
    expect(p.status).toBe("intact");
  });

  it("손절선 아래로 내려가면 깨짐이다", () => {
    const [p] = resolvePremises([premise({ checkConfig: { kind: "stop-loss", value: 75_000 } })], QUOTE);
    expect(p.status).toBe("broken");
  });

  it.each(["value-ceiling", "stop-loss"] as const)("경계값은 지킨 것으로 본다 — %s", (kind) => {
    const [p] = resolvePremises([premise({ checkConfig: { kind, value: 70_000 } })], QUOTE);
    expect(p.status).toBe("intact");
  });
});

describe("resolvePremises — 도달 목표", () => {
  function target(value: number) {
    return premise({ checkConfig: { kind: "target-price", value } });
  }

  // #85: 목표가 미도달은 "생각이 틀어짐"이 아니다. `broken`을 내면 배지가 오염되고
  // `intact`를 내면 "이 전제는 유효하다"고 거짓말한다 — 그래서 어휘가 따로 있다.
  it("아직 닿지 않았으면 awaiting — broken도 intact도 아니다", () => {
    const [p] = resolvePremises([target(90_000)], QUOTE);
    expect(p.status).toBe("awaiting");
    expect(p.observedValue).toBe("70,000원");
  });

  it("닿으면 reached", () => {
    const [p] = resolvePremises([target(65_000)], QUOTE);
    expect(p.status).toBe("reached");
  });

  it("경계값은 도달로 본다", () => {
    const [p] = resolvePremises([target(70_000)], QUOTE);
    expect(p.status).toBe("reached");
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

  // #88: 기다리면 풀리는 자리(`pending`)와 그렇지 않은 자리(`unreadable`)를 갈라 둔다.
  // 한 값에 담으면 화면이 영구 판정 불가에도 "잠시 기다리는 중"처럼 안내하게 된다.
  it("기준값이 없으면 시세가 있어도 unreadable이다 — 기다려도 풀리지 않는다", () => {
    const [p] = resolvePremises([premise({ checkConfig: undefined, status: "intact" })], QUOTE);
    expect(p.status).toBe("unreadable");
  });

  it("방향(kind)을 잃은 예전 형식의 행은 unreadable이다", () => {
    const [p] = resolvePremises([premise({ checkConfig: { value: 63_000 } })], QUOTE);
    expect(p.status).toBe("unreadable");
  });

  it("설정을 읽을 수 없으면 시세를 기다리는 중에도 unreadable이다", () => {
    const [p] = resolvePremises([premise({ checkConfig: undefined })], null);
    expect(p.status).toBe("unreadable");
  });
});

describe("resolvePremises — 유지 조건 (valuation)", () => {
  function valuation(config: Premise["checkConfig"]): Premise {
    return premise({ checkType: "valuation", checkConfig: config });
  }

  it("PER 기준을 만족하면 유지로 확정하고 배수로 표기한다", () => {
    const [p] = resolvePremises([valuation({ kind: "value-ceiling", metric: "per", value: 15 })], QUOTE);
    expect(p.status).toBe("intact");
    expect(p.observedValue).toBe("12.0배");
  });

  it("PBR 기준을 벗어나면 깨짐으로 확정한다", () => {
    const [p] = resolvePremises([valuation({ kind: "value-ceiling", metric: "pbr", value: 1 })], QUOTE);
    expect(p.status).toBe("broken");
    expect(p.observedValue).toBe("1.1배");
  });

  it("metric이 없으면 unreadable이다 — 어느 지표인지 모르면 시세를 기다려도 소용없다", () => {
    const [p] = resolvePremises([valuation({ kind: "value-ceiling", value: 15 })], QUOTE);
    expect(p.status).toBe("unreadable");
  });

  // 원인이 아니라 회복 가능성으로 가른다 (#92). 여기서 비어 있는 것은 전제가 아니라
  // 시세 쪽이지만, 적자기업·신규상장은 KIS가 PER을 끝내 주지 않으므로 기다려도 오지
  // 않는다. `pending`으로 두면 화면이 영원히 "잠시 기다리는 중"이라고 안내한다.
  it("시세는 왔는데 지표가 비면 unreadable이다 — 기다려도 오지 않는 값이 있다", () => {
    const [p] = resolvePremises(
      [valuation({ kind: "value-ceiling", metric: "per", value: 15 })],
      { price: 70_000, changePercent: 1.2 }
    );
    expect(p.status).toBe("unreadable");
  });

  // 위와 짝을 이루는 대조군. 이쪽은 다음 조회에서 풀리므로 `pending`이 맞다 —
  // 둘이 갈라져 있다는 사실 자체를 잠근다.
  it("시세를 아직 못 받았으면 pending이다 — 이쪽은 기다리면 풀린다", () => {
    const [p] = resolvePremises(
      [valuation({ kind: "value-ceiling", metric: "per", value: 15 })],
      null
    );
    expect(p.status).toBe("pending");
  });

  // 배지 보장: unreadable은 broken이 아니므로 "달라짐"에 투표하지 않는다.
  // PER을 안 주는 종목이 통째로 "달라짐"으로 뜨면 이 변경이 만든 최악의 회귀가 된다.
  it("지표가 비어도 배지에는 투표하지 않는다", () => {
    const [p] = resolvePremises(
      [valuation({ kind: "value-ceiling", metric: "per", value: 15 })],
      { price: 70_000, changePercent: 1.2 }
    );
    expect(p.status).not.toBe("broken");
    expect(p.observedValue).toBeUndefined();
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
        premise({ id: "c", checkConfig: { kind: "stop-loss", value: 100_000 } }),
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
    expect(parseCheckConfig({ kind: "value-ceiling", metric: "per", value: 15, extra: "무시" })).toEqual({
      kind: "value-ceiling",
      metric: "per",
      value: 15,
    });
  });

  it("알 수 없는 값은 버린다", () => {
    expect(parseCheckConfig({ kind: "floor", metric: "roe", value: "15" })).toBeUndefined();
  });

  // 방향을 잃은 기준값은 판정할 수 없다. `resolvePremises`가 `unreadable`로 떨어뜨려
  // 판정 불가를 드러내는 편이, 방향을 임의로 가정하는 것보다 낫다.
  it("kind가 없으면 남은 값만 살리고 방향은 비운다 — 예전 형식의 행", () => {
    expect(parseCheckConfig({ operator: "gte", value: 100 })).toEqual({
      kind: undefined,
      metric: undefined,
      value: 100,
    });
  });

  it.each([[null], [undefined], ["문자열"], [42]])("객체가 아니면 undefined (%s)", (raw) => {
    expect(parseCheckConfig(raw)).toBeUndefined();
  });

  it("일부 필드만 있어도 그 부분은 살린다", () => {
    expect(parseCheckConfig({ kind: "stop-loss", value: 100 })).toEqual({
      kind: "stop-loss",
      metric: undefined,
      value: 100,
    });
  });
});
