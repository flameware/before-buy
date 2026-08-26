// S3 "이대로 담기": generateThesisResult가 만든 quote/critique를 재사용해
// watchlist_item -> thesis -> critique/premises를 한 번의 db.batch로 원자적으로
// 심는다 (seed.ts의 provisionSeedItems와 같은 패턴 — UUID를 미리 만들어 부분 실패로
// 반쪽짜리 관심종목이 남지 않게 한다).
//
// premises.status 초기값: price/valuation은 다음 판정(S1 로드/S5 진입)을 기다리는
// "pending", fundamental/qualitative는 엔진이 건드리지 않는 "manual"
// (premises/engine.ts 상단 주석 참고).

import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { critiques, premises, theses, watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";
import type { CritiqueOutput } from "@/lib/llm/types";
import { findStock } from "@/lib/mock/stock-universe";
import type { QuoteSnapshot } from "@/lib/mock/types";
import type { ThesisDraftInput } from "./generate-result";

const AUTO_CHECK_TYPES = new Set(["price", "valuation"]);

export async function commitThesis(
  ticker: string,
  draft: ThesisDraftInput,
  critique: CritiqueOutput,
  quote: QuoteSnapshot
): Promise<void> {
  return withSession(async (sessionId) => {
    const stock = findStock(ticker);
    if (!stock) throw new Error(`Unknown ticker: ${ticker}`);

    const watchlistItemId = randomUUID();
    const thesisId = randomUUID();

    const queries: unknown[] = [
      db.insert(watchlistItems).values({
        id: watchlistItemId,
        sessionId,
        ticker,
        name: stock.name,
        status: "watching",
        addedPrice: String(quote.price),
        addedAt: new Date(),
        isSeed: false,
      }),
      db.insert(theses).values({
        id: thesisId,
        watchlistItemId,
        category: draft.category,
        followup: draft.followup,
        freeText: draft.freeText ?? null,
      }),
      db.insert(critiques).values({
        thesisId,
        isChallengeable: critique.isChallengeable,
        counterpoints: critique.counterpoints,
        openQuestions: critique.openQuestions,
        rawResponse: critique.rawResponse,
      }),
    ];

    // gut 카테고리는 전제가 0개일 수 있음(mock generatePremises와 동일 관례) — 빈
    // VALUES insert는 보내지 않는다.
    if (critique.premises.length > 0) {
      queries.push(
        db.insert(premises).values(
          critique.premises.map((p) => ({
            thesisId,
            statement: p.statement,
            checkType: p.checkType,
            checkConfig: p.checkConfig ?? null,
            status: AUTO_CHECK_TYPES.has(p.checkType) ? "pending" : "manual",
          }))
        )
      );
    }

    await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
  });
}
