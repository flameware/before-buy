// 답 자리의 네 갈래를 잠근다 (#159).
//
// 이 문자열은 모델에게 가는 계약이고, 그 형식은 `프롬프트 명세.md` 3장에 박혀 있다 — 여기서
// 모양이 바뀌면 few-shot 예시의 user 턴이 실제 입력과 어긋난다(#121이 고친 바로 그 어긋남).
// 결합 갈래를 구분자까지 통째로 대조하는 이유가 그것이다.

import { describe, expect, it } from "vitest";
import { buildFollowupSummary } from "./followup-summary";

describe("buildFollowupSummary — 답 자리의 네 갈래", () => {
  it("선택지: 고른 선택지의 라벨을 쓴다", () => {
    expect(buildFollowupSummary("undervalued", [{ questionId: "metric", selected: "per" }])).toBe(
      "어느 지표로 보셨어요?: PER"
    );
  });

  // 무선택이 곧 건너뜀이다 (#96). 관측한 사실까지만 말한다.
  it("건너뜀: 답하지 않음", () => {
    expect(buildFollowupSummary("undervalued", [{ questionId: "metric", skipped: true }])).toBe(
      "어느 지표로 보셨어요?: 답하지 않음"
    );
  });

  // 선택지가 없는 문항(`theme-name` 등)은 사용자가 친 원문이 그대로 답이 된다.
  it("자유 입력만: 사용자 원문을 그대로 쓴다", () => {
    expect(
      buildFollowupSummary("theme", [{ questionId: "theme-name", freeText: "유럽 재무장" }])
    ).toBe("어떤 테마인가요?: 유럽 재무장");
  });

  // 목표가·손절가가 제품에 들어오는 정상 경로다 — 선택지가 `직접 입력`과 `정하지 않음` 뿐이다.
  it("선택지 + 자유 입력: 라벨과 원문을 ` · `로 잇는다", () => {
    expect(
      buildFollowupSummary("undervalued", [
        { questionId: "target-price", selected: "custom", freeText: "285000" },
      ])
    ).toBe("어디까지 오르면 제값이라고 보세요?: 목표가 직접 입력 · 285000");
  });

  it("결합 구분자는 공백-가운뎃점-공백이다", () => {
    const summary = buildFollowupSummary("technical", [
      { questionId: "target-price", selected: "custom", freeText: "300000" },
    ]);
    expect(summary).toContain(" · ");
    expect(summary.endsWith("목표가 직접 입력 · 300000")).toBe(true);
  });

  // 사용자가 친 것을 다듬지 않는다 — 숫자로 바꾸는 것은 근거를 읽는 LLM의 일이다.
  it.each(["285000", "285,000", "28만 5천원", "+15%"])("원문 %s를 그대로 넘긴다", (freeText) => {
    expect(
      buildFollowupSummary("undervalued", [
        { questionId: "target-price", selected: "custom", freeText },
      ])
    ).toBe(`어디까지 오르면 제값이라고 보세요?: 목표가 직접 입력 · ${freeText}`);
  });

  it("문항마다 한 줄이고 줄바꿈으로 잇는다", () => {
    expect(
      buildFollowupSummary("undervalued", [
        { questionId: "cheap-vs-what", selected: "peers" },
        { questionId: "metric", skipped: true },
      ])
    ).toBe("무엇 대비 싸다고 보세요?: 동종업계\n어느 지표로 보셨어요?: 답하지 않음");
  });
});
