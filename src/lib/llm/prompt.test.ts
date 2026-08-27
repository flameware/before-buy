// few-shot 예시가 스스로 규칙을 어기지 않는지 잠근다 (#114).
//
// 예시는 모델에게 "이렇게 답하라"고 보여주는 것이므로, 예시가 어기는 규칙은 응답도 어긴다.
// 그런데 예시는 손으로 쓴 JSON이라 형식 스키마도 검증(`findSemanticProblems`)도 거치지 않고
// 프롬프트에 실린다 — 여기서만 잡힌다. 예시가 `findSemanticProblems`에 걸리는 형태였다면
// 모델이 그것을 따라했을 때 재시도가 걸리고, 재시도 실패는 `LLMError`라 S2 흐름이 죽는다.

import { describe, expect, it } from "vitest";
import type { ThesisCategory } from "@/lib/mock/types";
import { buildFewShotMessages, buildSystemPrompt } from "./prompt";
import { CritiqueOutputSchema, findSemanticProblems } from "./schemas";
import type { CritiqueInput } from "./types";

const CATEGORIES: ThesisCategory[] = [
  "fundamental",
  "undervalued",
  "theme",
  "dividend",
  "technical",
  "recommended",
  "gut",
];

function input(category: ThesisCategory, overrides: Partial<CritiqueInput> = {}): CritiqueInput {
  return {
    sessionId: "s",
    ticker: "000000",
    stockName: "테스트종목",
    category,
    followupSummary: "- 질문\n  → 답",
    price: 10_000,
    per: 10,
    pbr: 1,
    ...overrides,
  };
}

/** 예시의 user 턴에 적힌 현재가. `findSemanticProblems`가 가격 기준선을 대조할 기준이다. */
function anchorPriceOf(userContent: string): number {
  const matched = userContent.match(/현재가 ([\d,]+)원/);
  if (!matched) throw new Error(`예시 user 턴에서 현재가를 찾지 못했습니다: ${userContent}`);
  return Number(matched[1].replaceAll(",", ""));
}

function exampleOf(messages: ReturnType<typeof buildFewShotMessages>) {
  const [user, assistant] = messages;
  expect(user.role).toBe("user");
  expect(assistant.role).toBe("assistant");
  expect(typeof user.content).toBe("string");
  expect(typeof assistant.content).toBe("string");

  const parsed = CritiqueOutputSchema.safeParse(JSON.parse(assistant.content as string));
  if (!parsed.success) throw new Error(`예시가 출력 스키마를 통과하지 못했습니다: ${parsed.error}`);
  return { anchorPrice: anchorPriceOf(user.content as string), output: parsed.data };
}

/** 카테고리 7종 + `정보 없음` 변형 = 프롬프트에 실릴 수 있는 8벌 전부. */
const ALL_EXAMPLES: { label: string; messages: ReturnType<typeof buildFewShotMessages> }[] = [
  ...CATEGORIES.map((category) => ({
    label: category,
    messages: buildFewShotMessages(input(category)),
  })),
  {
    label: "undervalued(정보 없음 변형)",
    messages: buildFewShotMessages(input("undervalued", { per: undefined })),
  },
];

describe("few-shot 예시 — 스스로 규칙을 어기지 않는다", () => {
  it.each(ALL_EXAMPLES)("$label 예시가 출력 스키마를 통과한다", ({ messages }) => {
    expect(() => exampleOf(messages)).not.toThrow();
  });

  it.each(ALL_EXAMPLES)("$label 예시에 findSemanticProblems가 걸리지 않는다", ({ messages }) => {
    const { anchorPrice, output } = exampleOf(messages);
    expect(findSemanticProblems(output, anchorPrice)).toEqual([]);
  });

  // 명세 2장: 모든 키가 필수이고 빈 자리는 null이다. `check_config: null`로 통째로 비우면
  // 스키마는 통과하지만 명세와 다른 것을 가르친다.
  it.each(ALL_EXAMPLES)("$label 예시의 check_config가 네 키를 모두 채운다", ({ messages }) => {
    for (const premise of exampleOf(messages).output.premises) {
      expect(premise.check_config).not.toBeNull();
      expect(Object.keys(premise.check_config!).sort()).toEqual([
        "kind",
        "metric",
        "period",
        "value",
      ]);
    }
  });
});

describe("buildFewShotMessages — 카테고리와 짝을 맞춘다", () => {
  it.each(CATEGORIES)("%s는 한 벌(user + assistant 두 개)만 보낸다", (category) => {
    expect(buildFewShotMessages(input(category))).toHaveLength(2);
  });

  it("카테고리마다 서로 다른 예시를 돌려준다", () => {
    const users = CATEGORIES.map((c) => buildFewShotMessages(input(c))[0].content);
    expect(new Set(users).size).toBe(CATEGORIES.length);
  });

  it("예시의 카테고리 줄이 그 카테고리와 같다 — 지침과 예시는 짝으로 움직인다", () => {
    for (const category of CATEGORIES) {
      const [user] = buildFewShotMessages(input(category));
      expect(user.content).toContain(`카테고리: ${category}`);
    }
  });

  // #111: 사용자가 답한 지표가 이 종목에 오지 않는 상황의 정답을 보여주는 변형으로
  // **바꿔 끼운다**. 덧붙이지 않으므로 그때도 두 개다.
  it("undervalued에 지표가 비면 정보 없음 변형으로 바뀐다", () => {
    const messages = buildFewShotMessages(input("undervalued", { per: undefined }));
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain("PER 정보 없음");
    expect(messages[0].content).toContain("→ PER");
  });

  it("다른 카테고리는 지표가 비어도 자기 예시를 그대로 쓴다", () => {
    const withMetrics = buildFewShotMessages(input("technical"));
    const withoutMetrics = buildFewShotMessages(input("technical", { per: undefined }));
    expect(withoutMetrics).toEqual(withMetrics);
  });
});

describe("few-shot 예시 — is_challengeable 편향을 막는 배치", () => {
  // 카테고리마다 예시가 한 벌뿐이라, 전부 true면 모델은 false를 내는 법을 배울 자리가 없다.
  it.each(["dividend", "technical"] as const)("%s 예시는 false를 가르친다", (category) => {
    const { output } = exampleOf(buildFewShotMessages(input(category)));
    expect(output.is_challengeable).toBe(false);
    expect(output.counterpoints).toEqual([]);
  });

  it("반박이 있는 예시는 counterpoints가 비어 있지 않다", () => {
    for (const category of CATEGORIES) {
      const { output } = exampleOf(buildFewShotMessages(input(category)));
      if (!output.is_challengeable) continue;
      expect(output.counterpoints.length).toBeGreaterThan(0);
    }
  });
});

describe("few-shot 예시 — 사용자가 말하지 않은 숫자를 만들지 않는다", () => {
  // 원칙 4가 분량 원칙("가능하면 최소 하나는 price/valuation")보다 우선한다는 것을
  // 이 두 예시가 가르친다. 자동 전제를 채워 넣으면 그 교육이 사라진다.
  it.each(["fundamental", "theme"] as const)("%s 예시에는 자동 전제가 없다", (category) => {
    const { output } = exampleOf(buildFewShotMessages(input(category)));
    const auto = output.premises.filter(
      (p) => p.check_type === "price" || p.check_type === "valuation"
    );
    expect(auto).toEqual([]);
  });

  // gut 지침은 "premises는 1개 이하". 분량 원칙(2~4개)보다 우선한다.
  it("gut 예시의 전제는 1개 이하다", () => {
    const { output } = exampleOf(buildFewShotMessages(input("gut")));
    expect(output.premises.length).toBeLessThanOrEqual(1);
  });
});

describe("buildSystemPrompt — 지침이 붙는 자리", () => {
  it.each(CATEGORIES)("%s 지침에 '반박할 지점이 약한 경우'가 있다", (category) => {
    expect(buildSystemPrompt(category)).toContain("반박할 지점이 약한 경우");
  });

  // #114/#116: 카테고리 규칙이므로 공통 본문이 아니라 undervalued 블록에 산다.
  it("없는 지표 규칙은 undervalued에만 실린다", () => {
    const rule = "그 지표로는 만들지 않습니다";
    expect(buildSystemPrompt("undervalued")).toContain(rule);
    for (const category of CATEGORIES.filter((c) => c !== "undervalued")) {
      expect(buildSystemPrompt(category)).not.toContain(rule);
    }
  });

  it("공통 본문에 '사용자가 말하지 않은 숫자를 만들어내지 마세요'가 있다", () => {
    for (const category of CATEGORIES) {
      expect(buildSystemPrompt(category)).toContain("사용자가 말하지 않은 숫자를 만들어내지 마세요");
    }
  });
});
