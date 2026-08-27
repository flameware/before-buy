// S3 진입 시 1회: draft(S2)에 실 KIS 시세를 붙여 LLM(critique+전제)을 호출한다.
// 결과는 DB에 쓰지 않는다 — 화면에 보여줄 뿐이고, 영속화는 사용자가 "이대로 담기"를
// 눌렀을 때 commitThesis(같은 quote/critiqueOutput을 그대로 재사용)의 몫이다. 이렇게
// 나누는 이유: LLM은 세션당 20회 상한이 있는 유상 호출이라, "다시 쓰기"로 되돌아가거나
// 새로고침 없이 그대로 담는 흔한 경로에서 호출을 두 번 태우지 않기 위함이다.

import "server-only";
import { withSession } from "@/lib/db/session";
import { getKoreanStockPrices } from "@/lib/kis/batch-quote";
import { generateCritiqueAndPremises } from "@/lib/llm/critique";
import { LLMCallLimitExceededError, LLMError, type CritiqueOutput } from "@/lib/llm/types";
import { resolveStock } from "@/lib/stock/resolve-stock";
import type { QuoteSnapshot, ThesisCategory, FollowupAnswer } from "@/lib/mock/types";
import { buildFollowupSummary } from "./followup-summary";

export interface ThesisDraftInput {
  category: ThesisCategory;
  followup: FollowupAnswer[];
  freeText?: string;
}

export type GenerateThesisResultOutcome =
  | { ok: true; quote: QuoteSnapshot; critique: CritiqueOutput }
  | { ok: false; reason: "quote-unavailable" | "llm-call-limit-exceeded" | "llm-error" };

export async function generateThesisResult(
  ticker: string,
  draft: ThesisDraftInput
): Promise<GenerateThesisResultOutcome> {
  return withSession(async (sessionId) => {
    // 던지지 않는다 — 이름을 모르는 것과 종목이 없는 것은 다르다. 존재하지 않는
    // 티커는 바로 아래 KIS 시세 조회가 `quote-unavailable`로 걸러낸다 (#92).
    const stock = await resolveStock(ticker);

    const results = await getKoreanStockPrices([ticker]);
    const result = results.get(ticker);
    if (!result?.ok) return { ok: false, reason: "quote-unavailable" };

    const quote: QuoteSnapshot = {
      price: result.data.price,
      changePercent: result.data.changePercent ?? 0,
      per: result.data.per,
      pbr: result.data.pbr,
    };

    try {
      const critique = await generateCritiqueAndPremises({
        sessionId,
        ticker,
        stockName: stock.name,
        sector: stock.sector,
        category: draft.category,
        followupSummary: buildFollowupSummary(draft.category, draft.followup),
        freeText: draft.freeText,
        price: quote.price,
        per: quote.per,
        pbr: quote.pbr,
      });
      return { ok: true, quote, critique };
    } catch (error) {
      // LLMCallLimitExceededError extends LLMError — check the specific case first.
      if (error instanceof LLMCallLimitExceededError) {
        return { ok: false, reason: "llm-call-limit-exceeded" };
      }
      // 스키마 검증 실패(모델이 tool 입력을 스펙과 다르게 반환, 재시도 1회 포함해도
      // 실패) 등 다른 LLM 실패는 화면에 에러로 노출하고 재시도를 유도한다 — 예외를
      // 그대로 던지면 Server Action 호출부에서 unhandled rejection이 되어 화면이
      // 로딩 상태로 멈춘다.
      if (error instanceof LLMError) {
        return { ok: false, reason: "llm-error" };
      }
      throw error;
    }
  });
}
