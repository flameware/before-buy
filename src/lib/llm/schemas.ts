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
import type { ThesisCategory } from "@/lib/mock/types";
import type { LLMCheckConfig, LLMPremise } from "./types";

const FORBIDDEN_WORDS = ["논지", "가설", "전제", "테제", "정합성", "밸류에이션"];

// `operator`를 받지 않는다 (ADR-0007). 비교 방향은 `kind`가 결정하고 엔진이 도출한다 —
// 모델에게 자유도를 주는 자리가 곧 틀릴 수 있는 자리인데, 이 자리는 자유도가 필요 없다.
const CheckConfigSchema = z.object({
  kind: z.enum(["stop-loss", "value-ceiling", "target-price"]).nullable(),
  metric: z.enum(["per", "pbr"]).nullable(),
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
 * 가격 기준선이 담은 날 가격의 옳은 쪽에 있는지 본다. **경계는 허용한다** — 사용자가
 * 현재가를 그대로 손절선이나 목표가로 답하는 것은 정상적인 답이다.
 */
function checkDirection(
  index: number,
  kind: "stop-loss" | "value-ceiling" | "target-price",
  value: number,
  anchorPrice: number
): string[] {
  const below = value <= anchorPrice;
  if (kind === "stop-loss" && !below) {
    return [`premises[${index}]: 손절선 ${value}는 담은 날 가격 ${anchorPrice}보다 높습니다`];
  }
  if (kind !== "stop-loss" && below && value !== anchorPrice) {
    const label = kind === "target-price" ? "목표가" : "가격 상한";
    return [`premises[${index}]: ${label} ${value}는 담은 날 가격 ${anchorPrice}보다 낮습니다`];
  }
  return [];
}

/**
 * 형식은 통과했지만 내용이 스펙에 어긋나는 지점을 모아 돌려준다.
 * 빈 배열이면 정상. 호출부는 비어 있지 않으면 재시도한다.
 *
 * `anchorPrice`는 사용자가 이 근거를 쓸 때 보고 있던 가격이다. 손절선은 그보다 아래,
 * 목표가는 그보다 위여야 말이 된다 — 이 대조가 없어서 "손절선인데 현재가보다 높은 값"이
 * 담은 날부터 깨진 전제로 보이는 버그가 통과했다(#85).
 */
export function findSemanticProblems(v: CritiqueRawOutput, anchorPrice: number): string[] {
  const problems: string[] = [];

  if (v.is_challengeable && v.counterpoints.length === 0) {
    problems.push("is_challengeable=true인데 counterpoints가 비어 있습니다 (모순 응답)");
  }

  for (const [i, p] of v.premises.entries()) {
    if (p.statement.trim().length === 0) {
      problems.push(`premises[${i}].statement가 비어 있습니다`);
    }
    if (p.check_type !== "price" && p.check_type !== "valuation") continue;

    const config = p.check_config;
    if (config?.kind == null || config.value == null) {
      problems.push(`premises[${i}]: price/valuation 전제는 check_config.kind와 value가 필요합니다`);
      continue;
    }

    if (p.check_type === "valuation") {
      if (config.kind !== "value-ceiling") {
        problems.push(`premises[${i}]: valuation 전제의 kind는 value-ceiling이어야 합니다 (받은 값: ${config.kind})`);
      }
      if (config.metric == null) {
        problems.push(`premises[${i}]: valuation 전제는 check_config.metric이 필요합니다`);
      }
      continue;
    }

    if (config.metric != null) {
      problems.push(`premises[${i}]: price 전제에는 check_config.metric을 쓰지 않습니다`);
    }
    problems.push(...checkDirection(i, config.kind, config.value, anchorPrice));
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

/** 이 종목에 값이 온 지표. `undefined`면 KIS가 끝내 주지 않는 지표다. */
export interface AvailableMetrics {
  per?: number;
  pbr?: number;
}

export interface UnavailableMetricPremise {
  index: number;
  metric: "per" | "pbr";
  statement: string;
}

/**
 * `metric`이 가리키는 지표가 이 종목에 오지 않는데도 온 valuation 전제를 모은다.
 * 저장되는 순간부터 영구히 **읽을 수 없음**이 되는 전제다 (#111, #92).
 *
 * 판정 단위는 시스템 프롬프트의 지시와 **같은 지표 하나**다 — PER이 없어도 PBR이 왔다면
 * PBR 기준 전제는 정상이고 잡히지 않는다. 단위가 어긋나면 정상 경로를 오탐한다.
 *
 * **`findSemanticProblems`와 섞지 않는다.** 그쪽 반환값은 곧 재시도이고 재시도 실패는
 * `LLMError`라, PER 없는 종목에서 모델이 고집을 부리면 근거 쓰기 자체가 죽는다 —
 * 원래 버그보다 나쁜 실패 모드다. 여기서 나온 결과는 경고로만 쓰이고 응답도 전제도
 * 그대로 통과한다.
 */
export function findUnavailableMetricPremises(
  v: CritiqueRawOutput,
  metrics: AvailableMetrics
): UnavailableMetricPremise[] {
  const found: UnavailableMetricPremise[] = [];

  for (const [index, p] of v.premises.entries()) {
    if (p.check_type !== "valuation") continue;
    const metric = p.check_config?.metric;
    if (metric == null || metrics[metric] != null) continue;
    found.push({ index, metric, statement: p.statement });
  }

  return found;
}

/**
 * 없는 지표를 쓴 저평가선 전제를 콘솔에 남긴다. `logForbiddenWords`와 같은 계열 —
 * 잡아내되 흐름을 실패시키지 않는다. 코드로 막지 않기로 한 이상(prompt.ts의
 * `UNAVAILABLE_METRIC_RULE` 주석) 지시를 어긴 응답을 아무도 모르는 상태로 두지 않기 위한 층이다.
 */
export function logUnavailableMetricPremises(v: CritiqueRawOutput, metrics: AvailableMetrics): void {
  for (const { index, metric, statement } of findUnavailableMetricPremises(v, metrics)) {
    console.warn(
      `[llm/critique] 이 종목에 ${metric.toUpperCase()}가 없는데 저평가선 전제가 왔습니다 — ` +
        `premises[${index}]: "${statement}" (판정되지 않고 읽을 수 없음으로 남는다)`
    );
  }
}

/**
 * 카테고리와 `is_challengeable`을 한 줄로 남긴다. 집계는 운영 로그에서 한다.
 *
 * 이 줄이 #114 설계의 **계기판**이다. 카테고리마다 few-shot 예시가 한 벌뿐이라, 그 예시가
 * `true`인 카테고리에서는 모델이 `false`를 내는 법을 배울 기회가 없다 — 원칙 3(억지 반박
 * 금지)이 가장 무너지기 쉬운 자리다. 예시 7벌 중 2벌을 `false`로 두고 각 지침에 "반박할
 * 지점이 약한 경우" 한 줄을 넣어 막았지만, 실제로 막혔는지는 분포로만 알 수 있다.
 * **전 카테고리 90% 이상 `true`면 원칙 3이 죽은 것이다**(명세 5장).
 *
 * `logForbiddenWords`·`logUnavailableMetricPremises`와 같은 계열 — 반환값 없이 콘솔에만
 * 남기고 흐름을 바꾸지 않는다. **`findSemanticProblems`에 넣지 않는다.** 그쪽 반환값은 곧
 * 재시도이고 재시도 실패는 `LLMError`인데, 편향은 응답 하나만 보고는 판정할 수 없는 것이라
 * 개별 응답을 실패시킬 근거가 되지 못한다.
 */
export function logChallengeableDistribution(v: CritiqueRawOutput, category: ThesisCategory): void {
  console.info(
    `[llm/critique] category=${category} is_challengeable=${v.is_challengeable} ` +
      `counterpoints=${v.counterpoints.length}`
  );
}

/** 형식 스키마의 null을 도메인 타입의 undefined로 되돌린다. */
function toCamelCheckConfig(raw: CritiqueRawOutput["premises"][number]["check_config"]): LLMCheckConfig | undefined {
  if (!raw) return undefined;
  const config: LLMCheckConfig = {
    kind: raw.kind ?? undefined,
    metric: raw.metric ?? undefined,
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
