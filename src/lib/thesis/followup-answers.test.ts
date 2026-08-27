import { describe, expect, it } from "vitest";
import type { FollowupAnswer, FollowupQuestion } from "@/lib/mock";
import { canLeaveFollowups, isAnswered, toFollowupAnswers } from "./followup-answers";

const choice: FollowupQuestion = {
  id: "growth-type",
  prompt: "어떤 성장을 기대하세요?",
  options: [
    { value: "revenue", label: "매출 성장" },
    { value: "custom", label: "직접 입력" },
  ],
  allowsFreeText: true,
  isValueQuestion: false,
};

const freeOnly: FollowupQuestion = {
  id: "theme-name",
  prompt: "어떤 테마인가요?",
  options: [],
  allowsFreeText: true,
  isValueQuestion: false,
};

describe("isAnswered", () => {
  it("선택지를 고르면 답한 것", () => {
    expect(isAnswered(choice, { questionId: choice.id, selected: "revenue" })).toBe(true);
  });

  it("아무것도 없으면 답하지 않은 것", () => {
    expect(isAnswered(choice, undefined)).toBe(false);
    expect(isAnswered(choice, { questionId: choice.id })).toBe(false);
  });

  it("직접 입력은 텍스트가 있어야 답한 것", () => {
    const empty: FollowupAnswer = { questionId: choice.id, selected: "custom", freeText: "  " };
    expect(isAnswered(choice, empty)).toBe(false);
    expect(isAnswered(choice, { ...empty, freeText: "신사업" })).toBe(true);
  });

  it("선택지 없는 문항은 자유 입력만 본다", () => {
    expect(isAnswered(freeOnly, { questionId: freeOnly.id })).toBe(false);
    expect(isAnswered(freeOnly, { questionId: freeOnly.id, freeText: "2차전지" })).toBe(true);
  });
});

describe("toFollowupAnswers", () => {
  it("무선택 문항을 건너뜀으로 채운다 — 배열에서 빼지 않는다", () => {
    const result = toFollowupAnswers([choice, freeOnly], {
      [choice.id]: { questionId: choice.id, selected: "revenue" },
    });

    expect(result).toEqual([
      { questionId: choice.id, selected: "revenue" },
      { questionId: freeOnly.id, skipped: true },
    ]);
  });

  it("답한 문항은 그대로 통과한다", () => {
    const answer: FollowupAnswer = { questionId: freeOnly.id, freeText: "2차전지" };
    expect(toFollowupAnswers([freeOnly], { [freeOnly.id]: answer })).toEqual([answer]);
  });

  it("고른 뒤 해제한 문항은 건너뜀이 된다", () => {
    const result = toFollowupAnswers([choice], { [choice.id]: { questionId: choice.id } });
    expect(result).toEqual([{ questionId: choice.id, skipped: true }]);
  });
});

describe("canLeaveFollowups", () => {
  it("하나도 답하지 않으면 못 넘어간다", () => {
    expect(canLeaveFollowups([choice, freeOnly], {})).toBe(false);
  });

  it("하나만 답해도 넘어간다 — 나머지는 건너뛴 것으로 기록된다", () => {
    expect(
      canLeaveFollowups([choice, freeOnly], {
        [choice.id]: { questionId: choice.id, selected: "revenue" },
      })
    ).toBe(true);
  });
});
