import { describe, expect, it } from "vitest";
import { INITIAL_FETCH_PHASE, nextFetchPhase, type FetchPhase } from "./fetch-phase";

/** 렌더마다 들어온 `isFetching`을 차례로 먹여 마지막 단계를 돌려준다. */
function run(isFetchings: boolean[], from: FetchPhase = INITIAL_FETCH_PHASE): FetchPhase {
  return isFetchings.reduce(nextFetchPhase, from);
}

describe("nextFetchPhase", () => {
  it("조회가 시작하기 전에는 settled가 되지 않는다", () => {
    // #141의 핵심. `enabled: false`인 하이드레이션 전 프레임들에서 isFetching은 계속
    // false지만, 그 프레임의 캐시 값은 직전 데모 시점의 것이다.
    expect(run([false, false, false])).toBe("idle");
  });

  it("조회가 시작해서 끝나야 settled가 된다", () => {
    expect(run([false, true, false])).toBe("settled");
  });

  it("조회 중에는 settled가 아니다", () => {
    expect(run([false, true, true])).toBe("fetching");
  });

  it("한 번 settled가 되면 이후 재조회에도 풀리지 않는다", () => {
    // 시트가 열려 있는 동안 고정을 유지하는 것이 ADR-0005의 결정이다.
    expect(run([true, false, true, false, true])).toBe("settled");
  });

  it("첫 프레임부터 조회 중이어도 끝나면 settled가 된다", () => {
    expect(run([true, false])).toBe("settled");
  });
});
