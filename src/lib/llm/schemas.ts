// tool_use 응답 검증. 두 종류의 실패를 구분한다:
// - zod 파싱 실패: 필드가 아예 스펙과 다른 형태로 옴
// - refine 실패: 필드 형태는 맞지만 내용이 모순됨(프롬프트 명세.md 5장 체크리스트)
// 둘 다 critique.ts 입장에서는 "검증 실패 → 1회 재시도" 대상으로 동일하게 취급된다.

import { z } from "zod";
import type { LLMCheckConfig, LLMPremise } from "./types";

const FORBIDDEN_WORDS = ["논지", "가설", "전제", "테제", "정합성", "밸류에이션"];

const CheckConfigSchema = z
  .object({
    metric: z.enum(["per", "pbr"]).optional(),
    operator: z.enum(["lte", "gte"]).optional(),
    value: z.number().optional(),
    period: z.string().optional(),
  })
  .optional();

const PremiseSchema = z
  .object({
    statement: z.string().min(1),
    check_type: z.enum(["price", "valuation", "fundamental", "qualitative"]),
    check_config: CheckConfigSchema,
  })
  .refine(
    (p) =>
      p.check_type !== "price" && p.check_type !== "valuation"
        ? true
        : p.check_config?.operator !== undefined && p.check_config?.value !== undefined,
    { message: "price/valuation 전제는 check_config.operator와 value가 필요합니다" }
  );

export const CritiqueToolInputSchema = z
  .object({
    is_challengeable: z.boolean(),
    challenge_reason: z.string().optional(),
    counterpoints: z.array(
      z.object({
        point: z.string().min(1),
        severity: z.enum(["major", "minor"]),
        basis: z.string().min(1),
      })
    ),
    open_questions: z.array(z.string()),
    premises: z.array(PremiseSchema),
  })
  .refine((v) => !(v.is_challengeable && v.counterpoints.length === 0), {
    message: "is_challengeable=true인데 counterpoints가 비어 있습니다 (모순 응답)",
  });

export type CritiqueToolInput = z.infer<typeof CritiqueToolInputSchema>;

/** 사용자 대상 문구 필드에 금지어가 섞였는지 확인하고, 발견되면 콘솔에 남긴다. */
export function logForbiddenWords(input: CritiqueToolInput): void {
  const textFields = [
    input.challenge_reason,
    ...input.counterpoints.flatMap((c) => [c.point, c.basis]),
    ...input.open_questions,
    ...input.premises.map((p) => p.statement),
  ].filter((v): v is string => !!v);

  for (const text of textFields) {
    for (const word of FORBIDDEN_WORDS) {
      if (text.includes(word)) {
        console.warn(`[llm/critique] 금지어 "${word}" 포함된 응답 문구: "${text}"`);
      }
    }
  }
}

function toCamelCheckConfig(raw: CritiqueToolInput["premises"][number]["check_config"]): LLMCheckConfig | undefined {
  if (!raw) return undefined;
  return { metric: raw.metric, operator: raw.operator, value: raw.value, period: raw.period };
}

export function toPremises(input: CritiqueToolInput): LLMPremise[] {
  return input.premises.map((p) => ({
    statement: p.statement,
    checkType: p.check_type,
    checkConfig: toCamelCheckConfig(p.check_config),
  }));
}
