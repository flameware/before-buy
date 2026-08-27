import { describe, expect, it } from "vitest";
import { composeView } from "./compose-view";
import { QUOTE_FAILED, QUOTE_LOADING, settledQuote, type QuoteState } from "@/lib/quote/quote-state";
import type { Premise, QuoteSnapshot, Thesis } from "@/lib/mock/types";
import type { WatchlistListItem } from "@/lib/watchlist/get-watchlist";

const SNAPSHOT: QuoteSnapshot = { price: 70_000, changePercent: 1.2, per: 12, pbr: 1.1 };
const QUOTE_OK: QuoteState = settledQuote(SNAPSHOT);

/** 70,000원에서 깨지는 자동 전제 — 시세가 오면 "달라짐"이 되어야 하는 종목. */
const BROKEN_WHEN_PRICED: Premise = {
  id: "p1",
  statement: "60,000원 이하 유지",
  checkType: "price",
  checkConfig: { operator: "lte", value: 60_000 },
  status: "intact", // DB에 남아 있던 낡은 값 — 판정에 쓰이면 안 된다.
};

function thesis(premises: Premise[]): Thesis {
  return {
    category: "undervalued",
    followup: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    critique: { isChallengeable: false, counterpoints: [], openQuestions: [] },
    premises,
  };
}

function listItem(overrides: Partial<WatchlistListItem> = {}): WatchlistListItem {
  return {
    id: "w1",
    name: "삼성전자",
    ticker: "005930",
    status: "watching",
    isSeed: true,
    addedPrice: 65_000,
    addedAt: "2026-01-01T00:00:00.000Z",
    thesis: thesis([BROKEN_WHEN_PRICED]),
    ...overrides,
  };
}

describe("composeView", () => {
  it("시세 상태를 그대로 항목에 붙인다", () => {
    expect(composeView(listItem(), QUOTE_LOADING).quote).toEqual(QUOTE_LOADING);
    expect(composeView(listItem(), QUOTE_FAILED).quote).toEqual(QUOTE_FAILED);
    expect(composeView(listItem(), QUOTE_OK).quote).toEqual(QUOTE_OK);
  });

  it("조회 완료면 그 시세로 전제를 확정한다 — 배지는 화면에 그리는 바로 그 시세에서 나온다", () => {
    const item = composeView(listItem(), QUOTE_OK);
    expect(item.thesis?.premises[0].status).toBe("broken");
    expect(item.thesis?.premises[0].observedValue).toBe("70,000원");
  });

  // #79 회귀 잠금: 조회 중에 저장된 status가 새어 나가면 "달라짐"이어야 할 배지가
  // 1~2초간 "유지 중"으로 보인다.
  it.each([
    ["조회 중", QUOTE_LOADING],
    ["조회 실패", QUOTE_FAILED],
  ])("%s면 자동 전제를 pending으로 두어 판정 불가를 드러낸다", (_label, quote) => {
    const item = composeView(listItem(), quote);
    expect(item.thesis?.premises[0].status).toBe("pending");
    expect(item.thesis?.premises[0].observedValue).toBeUndefined();
  });

  it("근거가 없는 종목은 thesis 없이 시세만 붙는다", () => {
    const item = composeView(listItem({ thesis: undefined }), QUOTE_OK);
    expect(item.thesis).toBeUndefined();
    expect(item.quote).toEqual(QUOTE_OK);
  });

  it("목록의 나머지 필드는 손대지 않는다", () => {
    const source = listItem();
    const item = composeView(source, QUOTE_OK);
    expect(item.id).toBe(source.id);
    expect(item.name).toBe(source.name);
    expect(item.ticker).toBe(source.ticker);
    expect(item.status).toBe(source.status);
    expect(item.addedPrice).toBe(source.addedPrice);
  });

  it("입력 항목을 변경하지 않는다 — 목록 캐시를 공유하므로 제자리 수정은 캐시 오염이다", () => {
    const source = listItem();
    composeView(source, QUOTE_OK);
    expect(source.thesis?.premises[0].status).toBe("intact");
  });

  it("근거의 다른 필드는 보존한 채 전제만 갈아끼운다", () => {
    const item = composeView(listItem(), QUOTE_OK);
    expect(item.thesis?.category).toBe("undervalued");
    expect(item.thesis?.critique).toEqual(listItem().thesis?.critique);
  });
});
