import { describe, expect, it } from "vitest";
import {
  appendItem,
  coversAll,
  dropItem,
  quotesKey,
  retainQuotes,
  toTickerKey,
  type QuoteMap,
} from "./cache";
import type { WatchlistListItem } from "./get-watchlist";

function item(ticker: string, overrides: Partial<WatchlistListItem> = {}): WatchlistListItem {
  return {
    id: `id-${ticker}`,
    ticker,
    name: `종목 ${ticker}`,
    status: "watching",
    isSeed: false,
    addedPrice: 1000,
    addedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toTickerKey", () => {
  it("종목 구성이 같으면 순서가 달라도 같은 키다", () => {
    expect(toTickerKey([{ ticker: "005930" }, { ticker: "000660" }])).toBe(
      toTickerKey([{ ticker: "000660" }, { ticker: "005930" }])
    );
  });

  it("종목이 하나라도 달라지면 키가 달라진다 — 키가 조회 대상을 말해야 한다", () => {
    expect(toTickerKey([{ ticker: "005930" }])).not.toBe(
      toTickerKey([{ ticker: "005930" }, { ticker: "000660" }])
    );
  });
});

describe("quotesKey", () => {
  it("데모 시점이 다르면 다른 캐시 엔트리다 (ADR-0004)", () => {
    expect(quotesKey("current", "005930")).not.toEqual(quotesKey("future", "005930"));
  });
});

describe("appendItem", () => {
  it("새 종목은 목록 끝에 붙는다 — 서버 목록이 createdAt 오름차순이다", () => {
    const next = appendItem([item("005930")], item("000660"));
    expect(next.map((i) => i.ticker)).toEqual(["005930", "000660"]);
  });

  it("이미 있는 티커면 자리를 지키며 갈아끼운다 — 같은 종목이 두 장으로 늘지 않는다", () => {
    const next = appendItem(
      [item("005930"), item("000660")],
      item("005930", { addedPrice: 2000 })
    );
    expect(next.map((i) => i.ticker)).toEqual(["005930", "000660"]);
    expect(next[0].addedPrice).toBe(2000);
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const prev = [item("005930")];
    appendItem(prev, item("000660"));
    expect(prev).toHaveLength(1);
  });
});

describe("dropItem", () => {
  it("뺀 티커만 사라진다", () => {
    const next = dropItem([item("005930"), item("000660")], "005930");
    expect(next.map((i) => i.ticker)).toEqual(["000660"]);
  });

  it("목록에 없는 티커면 그대로 둔다", () => {
    const prev = [item("005930")];
    expect(dropItem(prev, "000660").map((i) => i.ticker)).toEqual(["005930"]);
  });
});

describe("retainQuotes", () => {
  const prev: QuoteMap = {
    "005930": { price: 70000, changePercent: 1 },
    "000660": null,
    "035720": { price: 50000, changePercent: -2 },
  };

  it("여전히 필요한 티커만 남긴다", () => {
    expect(Object.keys(retainQuotes(prev, ["005930", "000660"])).sort()).toEqual([
      "000660",
      "005930",
    ]);
  });

  it("조회 실패(null)도 결판난 사실이라 함께 이월된다", () => {
    expect(retainQuotes(prev, ["000660"])).toEqual({ "000660": null });
  });

  it("이전 맵에 없던 티커는 지어내지 않는다 — 자리를 비워 호출부가 알아채게 한다", () => {
    expect("068270" in retainQuotes(prev, ["005930", "068270"])).toBe(false);
  });
});

describe("coversAll", () => {
  it("모든 티커에 자리가 있어야 참이다", () => {
    expect(coversAll({ "005930": null }, ["005930"])).toBe(true);
  });

  it("빠진 티커가 있으면 거짓이다 — 부분 맵을 심으면 그 티커가 조회 실패로 읽힌다", () => {
    expect(coversAll({ "005930": null }, ["005930", "000660"])).toBe(false);
  });

  it("자리가 있고 값이 null인 것은 빠진 것이 아니다", () => {
    expect(coversAll({ "005930": null, "000660": null }, ["005930", "000660"])).toBe(true);
  });
});
