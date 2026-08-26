// 강제 tool-call로 structured output을 받기 위한 tool 정의.
// input_schema는 프롬프트 명세.md 4장의 출력 예시와 기술스펙 5-2의 스키마를 그대로 반영.

import type Anthropic from "@anthropic-ai/sdk";

export const CRITIQUE_TOOL_NAME = "submit_critique";

export const CRITIQUE_TOOL: Anthropic.Tool = {
  name: CRITIQUE_TOOL_NAME,
  description:
    "사용자가 작성한 투자 근거에 대한 검증 결과와, 거기서 도출한 전제 목록을 제출합니다.",
  input_schema: {
    type: "object",
    properties: {
      is_challengeable: { type: "boolean" },
      challenge_reason: { type: "string" },
      counterpoints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            point: { type: "string" },
            severity: { type: "string", enum: ["major", "minor"] },
            basis: { type: "string" },
          },
          required: ["point", "severity", "basis"],
        },
      },
      open_questions: { type: "array", items: { type: "string" } },
      premises: {
        type: "array",
        items: {
          type: "object",
          properties: {
            statement: { type: "string" },
            check_type: {
              type: "string",
              enum: ["price", "valuation", "fundamental", "qualitative"],
            },
            check_config: {
              type: "object",
              properties: {
                metric: { type: "string", enum: ["per", "pbr"] },
                operator: { type: "string", enum: ["lte", "gte"] },
                value: { type: "number" },
                period: { type: "string" },
              },
            },
          },
          required: ["statement", "check_type"],
        },
      },
    },
    required: ["is_challengeable", "counterpoints", "open_questions", "premises"],
  },
};
