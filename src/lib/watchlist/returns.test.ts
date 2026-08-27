import { describe, expect, it } from "vitest";
import { returnSinceAdded, returnSinceBuy } from "./returns";

describe("returnSinceAdded", () => {
  // 화면명세 S5의 관심종목 예시 — 담은 날 172,000원 → 현재 186,500원 +8.4%.
  it("담은 날 가격 대비로 계산한다", () => {
    expect(returnSinceAdded(186_500, 172_000)).toBeCloseTo(8.4, 1);
  });

  // #86 회귀 잠금: 여기에 전일 대비(`QuoteSnapshot.changePercent`)가 배선되어 있어서
  // 두 가격이 같은데 `-1.7%`가 붙는 헤더가 나갔다. 같은 가격이면 변화는 0이다.
  it("담은 날 가격과 현재가가 같으면 0이다 — 전일 대비가 새어 들어오면 여기가 깨진다", () => {
    expect(returnSinceAdded(401_000, 401_000)).toBe(0);
  });

  it("떨어졌으면 음수다", () => {
    expect(returnSinceAdded(78_200, 82_000)).toBeCloseTo(-4.6, 1);
  });
});

describe("returnSinceBuy", () => {
  // 화면명세 S5의 보유중 예시 — 매수 78,900원 → 현재 78,200원, 손익 -0.9%.
  it("매수가 대비로 계산한다", () => {
    expect(returnSinceBuy(78_200, 78_900)).toBeCloseTo(-0.9, 1);
  });
});

// 화면명세 S5: "두 기준이 모두 필요한 이유" — 담은 시점과 산 시점이 다를 수 있다.
// 같은 현재가에서 두 값이 갈리지 않으면 기준 하나가 잘못 배선된 것이다.
it("담은 날과 매수가가 다르면 두 기준이 서로 다른 값을 낸다", () => {
  const price = 78_200;
  expect(returnSinceAdded(price, 82_000)).toBeCloseTo(-4.6, 1);
  expect(returnSinceBuy(price, 78_900)).toBeCloseTo(-0.9, 1);
});

describe("기준 가격이 없을 때", () => {
  // 조회 계층이 빈 컬럼을 0으로 강제하므로 0이 실제로 도달한다. 그대로 나누면 Infinity다.
  it.each([
    ["0 (빈 컬럼이 강제된 값)", 0],
    ["null", null],
    ["undefined", undefined],
  ])("%s이면 null을 돌려준다 — 0%%를 지어내지 않는다", (_label, basePrice) => {
    expect(returnSinceAdded(401_000, basePrice)).toBeNull();
    expect(returnSinceBuy(401_000, basePrice)).toBeNull();
  });
});
