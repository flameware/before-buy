// 근거 검증 + 전제 추출 통합 호출 (기술스펙 5-2, 프롬프트 명세.md, 지도 #38 이슈 #42).
//
// 모든 Anthropic 호출은 이 함수를 거친다 — 세션당 호출 상한(20회)을 여기서
// 원자적으로 강제하므로 호출부가 우회할 수 없다. DB에 critiques/premises row를
// 쓰는 건 이 모듈의 일이 아니다 — 파싱된 결과를 반환할 뿐이고, 저장은 화면별
// 배선 티켓(#47 등)의 몫이다.
//
// 재시도는 두 레이어로 나뉜다: 네트워크/5xx/429는 client.ts의 SDK maxRetries가
// 전송 레벨에서 처리하고, 응답 내용이 스키마에 맞지 않거나 모순되는 경우(HTTP는
// 성공했지만 tool 입력이 잘못된 경우)는 SDK 재시도 범위 밖이라 이 함수가 같은
// 입력으로 한 번 더 수동 요청한다.

import "server-only";
import { incrementLlmCallCount } from "@/lib/db/session";
import { getAnthropicClient, CRITIQUE_MODEL } from "./client";
import { buildFewShotMessages, buildSystemPrompt, buildUserMessage } from "./prompt";
import { CritiqueToolInputSchema, logForbiddenWords, toPremises } from "./schemas";
import { CRITIQUE_TOOL, CRITIQUE_TOOL_NAME } from "./tool";
import { CritiqueInput, CritiqueOutput, LLMCallLimitExceededError, LLMError } from "./types";

// 1024는 few-shot 대화 검증 중 실측 출력(2~3개 counterpoints + 2~4개 premises)이
// max_tokens에 걸려 잘리는 걸 확인해 올림. 2048에서는 여유 있게 완결됨을 확인했다.
const MAX_TOKENS = 2048;
const VALIDATION_RETRY_COUNT = 1;

async function callOnce(input: CritiqueInput): Promise<unknown> {
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CRITIQUE_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(input.category),
    tools: [CRITIQUE_TOOL],
    tool_choice: { type: "tool", name: CRITIQUE_TOOL_NAME },
    messages: [...buildFewShotMessages(), { role: "user", content: buildUserMessage(input) }],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new LLMError("모델이 tool_use 블록을 반환하지 않았습니다");
  return toolUse.input;
}

/**
 * 검증 실패(zod 파싱 실패 또는 모순 refine 실패)에 한해 같은 입력으로 한 번 더
 * 요청한다. 전송 레벨 실패는 client.ts의 SDK maxRetries가 이미 처리했으므로
 * 여기 도달한 예외는 그대로 던진다 — 재시도할 대상이 아니다.
 */
async function callWithValidationRetry(input: CritiqueInput) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= VALIDATION_RETRY_COUNT; attempt++) {
    const raw = await callOnce(input);
    const parsed = CritiqueToolInputSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    lastError = parsed.error;
  }
  throw new LLMError(
    `모델 응답이 스키마 검증에 실패했습니다 (재시도 ${VALIDATION_RETRY_COUNT}회 포함): ${String(lastError)}`
  );
}

export async function generateCritiqueAndPremises(input: CritiqueInput): Promise<CritiqueOutput> {
  const allowed = await incrementLlmCallCount(input.sessionId);
  if (!allowed) {
    throw new LLMCallLimitExceededError("이 세션의 LLM 호출 상한(20회)을 넘었습니다");
  }

  const parsed = await callWithValidationRetry(input);
  logForbiddenWords(parsed);

  return {
    isChallengeable: parsed.is_challengeable,
    challengeReason: parsed.challenge_reason,
    counterpoints: parsed.counterpoints,
    openQuestions: parsed.open_questions,
    premises: toPremises(parsed),
    rawResponse: parsed,
  };
}
