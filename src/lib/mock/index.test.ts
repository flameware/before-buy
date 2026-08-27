import { describe, expect, it } from "vitest";
import { splitByStatus } from "./index";
import type { WatchlistItem } from "./types";

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
