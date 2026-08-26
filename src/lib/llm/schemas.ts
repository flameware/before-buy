// 구조화 출력(output_config.format) 스키마와 응답 검증.
//
// 스키마는 두 겹으로 나눠 둔다:
// - `CritiqueOutputSchema`: 모델에 넘길 출력 형식. 모든 키가 필수이고, 값이 없을 수 있는
//   자리는 optional이 아니라 nullable로 둔다. 형식 스키마가 곧 모델에 대한 제약이라
//   "키를 빼도 된다"는 여지를 주지 않는 편이 안정적이다(이슈 #58: premises 필드 누락).
// - `findSemanticProblems`: 형식은 맞지만 내용이 모순되는 경우(프롬프트 명세.md 5장
//   체크리스트). 형식 스키마로는 표현할 수 없어 파싱 후 별도로 본다.
//
// 둘 다 critique.ts 입장에서는 "검증 실패 → 1회 재시도" 대상으로 동일하게 취급된다.

import { z } from "zod";
import type { LLMCheckConfig, LLMPremise } from "./types";

const FORBIDDEN_WORDS = ["논지", "가설", "전제", "테제", "정합성", "밸류에이션"];

const CheckConfigSchema = z.object({
  metric: z.enum(["per", "pbr"]).nullable(),
  operator: z.enum(["lte", "gte"]).nullable(),
  value: z.number().nullable(),
  period: z.string().nullable(),
});

const PremiseSchema = z.object({
  statement: z.string(),
  check_type: z.enum(["price", "valuation", "fundamental", "qualitative"]),
  check_config: CheckConfigSchema.nullable(),
});

const CounterpointSchema = z.object({
  point: z.string(),
  severity: z.enum(["major", "minor"]),
  basis: z.string(),
});

export const CritiqueOutputSchema = z.object({
  is_challengeable: z.boolean(),
  challenge_reason: z.string(),
  counterpoints: z.array(CounterpointSchema),
  open_questions: z.array(z.string()),
  premises: z.array(PremiseSchema),
});

export type CritiqueRawOutput = z.infer<typeof CritiqueOutputSchema>;

/**
 * 형식은 통과했지만 내용이 스펙에 어긋나는 지점을 모아 돌려준다.
 * 빈 배열이면 정상. 호출부는 비어 있지 않으면 재시도한다.
 */
export function findSemanticProblems(v: CritiqueRawOutput): string[] {
  const problems: string[] = [];

  if (v.is_challengeable && v.counterpoints.length === 0) {
    problems.push("is_challengeable=true인데 counterpoints가 비어 있습니다 (모순 응답)");
  }

  for (const [i, p] of v.premises.entries()) {
    if (p.statement.trim().length === 0) {
      problems.push(`premises[${i}].statement가 비어 있습니다`);
    }
    if (p.check_type !== "price" && p.check_type !== "valuation") continue;
    if (p.check_config?.operator == null || p.check_config?.value == null) {
      problems.push(`premises[${i}]: price/valuation 전제는 check_config.operator와 value가 필요합니다`);
    }
  }

  for (const [i, c] of v.counterpoints.entries()) {
    if (c.point.trim().length === 0 || c.basis.trim().length === 0) {
      problems.push(`counterpoints[${i}]의 point 또는 basis가 비어 있습니다`);
    }
  }

  return problems;
}

/** 사용자 대상 문구 필드에 금지어가 섞였는지 확인하고, 발견되면 콘솔에 남긴다. */
export function logForbiddenWords(input: CritiqueRawOutput): void {
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

/** 형식 스키마의 null을 도메인 타입의 undefined로 되돌린다. */
function toCamelCheckConfig(raw: CritiqueRawOutput["premises"][number]["check_config"]): LLMCheckConfig | undefined {
  if (!raw) return undefined;
  const config: LLMCheckConfig = {
    metric: raw.metric ?? undefined,
    operator: raw.operator ?? undefined,
    value: raw.value ?? undefined,
    period: raw.period ?? undefined,
  };
  // 네 값이 모두 비어 있으면 check_config 자체가 없는 것으로 취급한다.
  return Object.values(config).every((v) => v === undefined) ? undefined : config;
}

export function toPremises(input: CritiqueRawOutput): LLMPremise[] {
  return input.premises.map((p) => ({
    statement: p.statement,
    checkType: p.check_type,
    checkConfig: toCamelCheckConfig(p.check_config),
  }));
}
