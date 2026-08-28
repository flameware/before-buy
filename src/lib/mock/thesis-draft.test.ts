import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearThesisDraft,
  getThesisDraft,
  resolveThesisResultOnce,
  setThesisDraft,
  type ThesisDraft,
} from "./thesis-draft";
import type { GenerateThesisResultOutcome } from "@/lib/thesis/generate-result";

const TICKER = "005930";

function draft(overrides: Partial<ThesisDraft> = {}): ThesisDraft {
  return {
    category: "undervalued",
    followup: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function success(price: number): Extract<GenerateThesisResultOutcome, { ok: true }> {
  return {
    ok: true,
    quote: { price, changePercent: 0 },
    critique: {
      isChallengeable: false,
      counterpoints: [],
      openQuestions: [],
      premises: [],
      rawResponse: "{}",
    },
  };
}

beforeEach(() => {
  clearThesisDraft(TICKER);
  clearThesisDraft("000660");
});

describe("setThesisDraft", () => {
  it("새 draft를 쓰면 앞선 draft의 결과 자리도 함께 버린다", async () => {
    setThesisDraft(TICKER, draft());
    await resolveThesisResultOnce(TICKER, async () => success(100));

    setThesisDraft(TICKER, draft({ freeText: "다시 씀" }));

    const generate = vi.fn(async () => success(200));
    await expect(resolveThesisResultOnce(TICKER, generate)).resolves.toEqual(success(200));
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("clearThesisDraft", () => {
  it("draft와 결과를 둘 다 지운다", async () => {
    setThesisDraft(TICKER, draft());
    await resolveThesisResultOnce(TICKER, async () => success(100));

    clearThesisDraft(TICKER);

    expect(getThesisDraft(TICKER)).toBeUndefined();
    const generate = vi.fn(async () => success(200));
    await resolveThesisResultOnce(TICKER, generate);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("resolveThesisResultOnce", () => {
  it("성공한 결과가 있으면 다시 태우지 않고 그대로 되돌려준다", async () => {
    const first = await resolveThesisResultOnce(TICKER, async () => success(100));

    const generate = vi.fn(async () => success(200));
    await expect(resolveThesisResultOnce(TICKER, generate)).resolves.toBe(first);
    expect(generate).not.toHaveBeenCalled();
  });

  it("진행 중이면 같은 promise를 돌려준다", async () => {
    const generate = vi.fn(async () => success(100));

    const a = resolveThesisResultOnce(TICKER, generate);
    const b = resolveThesisResultOnce(TICKER, generate);

    expect(b).toBe(a);
    expect(generate).toHaveBeenCalledTimes(1);
    await expect(b).resolves.toEqual(success(100));
  });

  it("실패한 결과는 자리에 남기지 않아 다시 시도가 새 호출을 태운다", async () => {
    const failed: GenerateThesisResultOutcome = { ok: false, reason: "llm-error" };
    await expect(resolveThesisResultOnce(TICKER, async () => failed)).resolves.toBe(failed);

    const generate = vi.fn(async () => success(100));
    await resolveThesisResultOnce(TICKER, generate);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("예외로 끝나도 자리를 비운다", async () => {
    await expect(
      resolveThesisResultOnce(TICKER, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const generate = vi.fn(async () => success(100));
    await resolveThesisResultOnce(TICKER, generate);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("진행 중에 새 draft를 쓰면 먼저 뜬 호출의 결과가 자리에 남지 않는다", async () => {
    const pending = resolveThesisResultOnce(TICKER, async () => success(100));
    setThesisDraft(TICKER, draft({ freeText: "다시 씀" }));
    await pending;

    const generate = vi.fn(async () => success(200));
    await resolveThesisResultOnce(TICKER, generate);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("종목이 다르면 서로 간섭하지 않는다", async () => {
    await resolveThesisResultOnce(TICKER, async () => success(100));

    const generate = vi.fn(async () => success(200));
    await expect(resolveThesisResultOnce("000660", generate)).resolves.toEqual(success(200));
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
