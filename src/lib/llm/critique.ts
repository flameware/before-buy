// 근거 검증 + 전제 추출 통합 호출 (기술스펙 5-2, 프롬프트 명세.md, 지도 #38 이슈 #42).
//
// 모든 Anthropic 호출은 이 함수를 거친다 — 세션당 호출 상한(20회)을 여기서
// 원자적으로 강제하므로 호출부가 우회할 수 없다. DB에 critiques/premises row를
// 쓰는 건 이 모듈의 일이 아니다 — 파싱된 결과를 반환할 뿐이고, 저장은 화면별
// 배선 티켓(#47 등)의 몫이다.
//
// 출력은 강제 tool-call이 아니라 구조화 출력(output_config.format)으로 받는다 —
// 이슈 #58에서 실측한 결과, 같은 모델·같은 프롬프트라도 강제 tool-call 경로에서만
// 사용자에게 보이는 한국어가 깨지고(문장의 5.8%) premises가 누락됐다. 구조화 출력에서는
// 같은 조건에서 깨짐 0%, premises 누락 0회였다. 자세한 실측표는 이슈 #58 참고.
//
// 재시도는 두 레이어로 나뉜다: 네트워크/5xx/429는 client.ts의 SDK maxRetries가
// 전송 레벨에서 처리하고, 응답 내용이 스키마에 맞지 않거나 모순되는 경우(HTTP는
// 성공했지만 내용이 잘못된 경우)는 SDK 재시도 범위 밖이라 이 함수가 같은
// 입력으로 한 번 더 수동 요청한다.

import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { incrementLlmCallCount } from "@/lib/db/session";
import { getAnthropicClient, CRITIQUE_MODEL } from "./client";
import { buildFewShotMessages, buildSystemPrompt, buildUserMessage } from "./prompt";
import {
  CritiqueOutputSchema,
  CritiqueRawOutput,
  findSemanticProblems,
  logChallengeableDistribution,
  logForbiddenWords,
  logUnavailableMetricPremises,
  toPremises,
} from "./schemas";
import { CritiqueInput, CritiqueOutput, LLMCallLimitExceededError, LLMError } from "./types";

// 구조화 출력 실측 평균 출력이 ~1,600 토큰이라 여유를 크게 잡는다. max_tokens는 상한일
// 뿐이라 실제로 쓴 만큼만 과금되고, 반대로 상한이 빠듯하면 스키마 마지막 필드(premises)가
// 통째로 절삭된다 — 이슈 #58에서 2048로 재현된 실패 모드다.
const MAX_TOKENS = 8192;
const VALIDATION_RETRY_COUNT = 1;

async function callOnce(input: CritiqueInput): Promise<CritiqueRawOutput> {
  const client = getAnthropicClient();
  const message = await client.messages.parse({
    model: CRITIQUE_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(input.category),
    output_config: { format: zodOutputFormat(CritiqueOutputSchema) },
    messages: [...buildFewShotMessages(input), { role: "user", content: buildUserMessage(input) }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new LLMError(`응답이 max_tokens(${MAX_TOKENS})에서 잘렸습니다`);
  }
  // parsed_output은 스키마 검증에 실패하면 null이다.
  if (!message.parsed_output) {
    throw new LLMError("모델 응답이 출력 스키마와 맞지 않습니다");
  }
  return message.parsed_output;
}

/**
 * 형식 검증 실패 또는 내용 모순에 한해 같은 입력으로 한 번 더 요청한다.
 * 전송 레벨 실패는 client.ts의 SDK maxRetries가 이미 처리했으므로 여기 도달한
 * 그 외 예외는 그대로 던진다 — 재시도할 대상이 아니다.
 */
async function callWithValidationRetry(input: CritiqueInput): Promise<CritiqueRawOutput> {
  let lastProblem = "";

  for (let attempt = 0; attempt <= VALIDATION_RETRY_COUNT; attempt++) {
    let parsed: CritiqueRawOutput;
    try {
      parsed = await callOnce(input);
    } catch (error) {
      if (!(error instanceof LLMError) || attempt === VALIDATION_RETRY_COUNT) throw error;
      lastProblem = error.message;
      continue;
    }

    const problems = findSemanticProblems(parsed, input.price);
    if (problems.length === 0) return parsed;
    lastProblem = problems.join("; ");
  }

  throw new LLMError(
    `모델 응답이 검증에 실패했습니다 (재시도 ${VALIDATION_RETRY_COUNT}회 포함): ${lastProblem}`
  );
}

export async function generateCritiqueAndPremises(input: CritiqueInput): Promise<CritiqueOutput> {
  const allowed = await incrementLlmCallCount(input.sessionId);
  if (!allowed) {
    throw new LLMCallLimitExceededError("이 세션의 LLM 호출 상한(20회)을 넘었습니다");
  }

  const parsed = await callWithValidationRetry(input);
  logForbiddenWords(parsed);
  // 경고만 남기고 흐름은 그대로 둔다 — 이 전제는 검증에 걸리지 않고 그대로 저장된다 (#111).
  logUnavailableMetricPremises(parsed, { per: input.per, pbr: input.pbr });
  // 카테고리마다 예시가 한 벌뿐이라 생기는 `true` 편향을 재는 유일한 층 (#114).
  logChallengeableDistribution(parsed, input.category);

  return {
    isChallengeable: parsed.is_challengeable,
    challengeReason: parsed.challenge_reason,
    counterpoints: parsed.counterpoints,
    openQuestions: parsed.open_questions,
    premises: toPremises(parsed),
    rawResponse: parsed,
  };
}
