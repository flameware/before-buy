import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryTimeoutError, withTimeout } from "./with-timeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("시간 안에 정착하면 그 값을 그대로 돌려준다", async () => {
    await expect(withTimeout(Promise.resolve("시세"), 10_000, "시세 조회")).resolves.toBe("시세");
  });

  it("시간 안에 깨지면 그 이유를 그대로 돌려준다 — 타임아웃으로 덮지 않는다", async () => {
    const cause = new Error("서버가 던졌다");
    await expect(withTimeout(Promise.reject(cause), 10_000, "시세 조회")).rejects.toBe(cause);
  });

  // #82의 본체: 영원히 미결인 promise. 이것을 깨우지 못하면 쿼리가 pending에 머문다.
  it("정착하지 않는 promise를 시간이 지나면 깨운다", async () => {
    const pending = withTimeout(new Promise<string>(() => {}), 10_000, "시세 조회");
    const settled = expect(pending).rejects.toThrow(QueryTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);
    await settled;
  });

  it("시간이 다 되기 전에는 깨우지 않는다", async () => {
    let done = false;
    const pending = withTimeout(new Promise<string>(() => {}), 10_000, "시세 조회").catch(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(done).toBe(true);
  });

  it("정착한 뒤에는 타이머를 남기지 않는다 — 조회마다 쌓이면 안 된다", async () => {
    await withTimeout(Promise.resolve("시세"), 10_000, "시세 조회");
    expect(vi.getTimerCount()).toBe(0);
  });
});
