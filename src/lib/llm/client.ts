// Anthropic 클라이언트 — 지도 #38 Notes: 세션당 호출 상한 20회를 이 모듈을 거치는
// 모든 호출에 강제한다. 네트워크/5xx/429 재시도는 SDK 내장 maxRetries에 맡기고,
// 스키마·모순 검증 실패에 대한 재시도는 critique.ts가 별도로 한 번 더 수행한다
// (SDK 재시도는 전송 레벨이라 응답 내용 검증에는 적용되지 않음).

import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const TIMEOUT_MS = 30_000;

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: TIMEOUT_MS,
    });
  }
  return client;
}

export const CRITIQUE_MODEL = "claude-sonnet-5";
