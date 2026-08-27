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
import { resolveStock } from "@/lib/stock/resolve-stock";
import type { Premise, QuoteSnapshot } from "@/lib/mock/types";
import type { SettledWatchlistItem } from "@/lib/watchlist/get-watchlist";
import type { ThesisDraftInput } from "./generate-result";

const AUTO_CHECK_TYPES = new Set(["price", "valuation"]);

/**
 * 담은 행을 근거·전제까지 붙여 그대로 돌려준다 (#107, ADR-0010). 심을 값이 이미 전부 이
 * 함수 안에 있으므로 DB를 다시 읽지 않는다. 전제는 **저장된 그대로**(price/valuation은
 * `pending`) 돌려준다 — 자동 전제의 status를 시세와 만나 확정하는 일은 화면 쪽
 * `composeView`가 맡는다(ADR-0004). 여기서 미리 확정해 돌려주면 목록 조회가 돌려주는
 * 모양과 어긋난다.
 */
export async function commitThesis(
  ticker: string,
  draft: ThesisDraftInput,
  critique: CritiqueOutput,
  quote: QuoteSnapshot
): Promise<SettledWatchlistItem> {
  return withSession(async (sessionId) => {
    // 여기까지 왔다는 건 S3가 시세를 받아냈다는 뜻이라 종목은 실재한다. 이름만
    // 모를 수 있고, 그때는 티커가 그대로 `watchlist_items.name`에 들어간다 (#92).
    const stock = await resolveStock(ticker);

    const watchlistItemId = randomUUID();
    const thesisId = randomUUID();
    const addedAt = new Date();
    const createdAt = new Date();

    // 전제 id도 미리 만든다 — 예전에는 `defaultRandom()`에 맡겼지만, 그러면 방금 심은
    // 전제를 돌려주기 위해 DB를 다시 읽어야 한다. 같은 파일의 watchlistItemId/thesisId가
    // 이미 쓰는 패턴이다.
    const storedPremises: Premise[] = critique.premises.map((p) => ({
      id: randomUUID(),
      statement: p.statement,
      checkType: p.checkType,
      checkConfig: p.checkConfig ?? undefined,
      status: AUTO_CHECK_TYPES.has(p.checkType) ? "pending" : "manual",
    }));

    const queries: unknown[] = [
      db.insert(watchlistItems).values({
        id: watchlistItemId,
        sessionId,
        ticker,
        name: stock.name,
        status: "watching",
        addedPrice: String(quote.price),
        addedAt,
        isSeed: false,
      }),
      db.insert(theses).values({
        id: thesisId,
        createdAt,
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
    if (storedPremises.length > 0) {
      queries.push(
        db.insert(premises).values(
          storedPremises.map((p) => ({
            id: p.id,
            thesisId,
            statement: p.statement,
            checkType: p.checkType,
            checkConfig: p.checkConfig ?? null,
            status: p.status,
          }))
        )
      );
    }

    await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);

    return {
      id: watchlistItemId,
      ticker,
      name: stock.name,
      status: "watching",
      isSeed: false,
      addedPrice: quote.price,
      addedAt: addedAt.toISOString(),
      thesis: {
        category: draft.category,
        followup: draft.followup,
        freeText: draft.freeText ?? undefined,
        createdAt: createdAt.toISOString(),
        critique: {
          isChallengeable: critique.isChallengeable,
          counterpoints: critique.counterpoints,
          openQuestions: critique.openQuestions,
        },
        premises: storedPremises,
      },
      quote,
    };
  });
}
