// S3 "이대로 담기": generateThesisResult가 만든 quote/critique를 재사용해
// watchlist_item -> thesis -> critique/premises를 한 번의 db.batch로 원자적으로
// 심는다 (seed.ts의 provisionSeedItems와 같은 패턴 — UUID를 미리 만들어 부분 실패로
// 반쪽짜리 관심종목이 남지 않게 한다).
//
// **근거 갱신(#98): 관심종목 1건 = `watchlist_item` 1행.** 이미 담긴 종목(세션 소유,
// watching|bought)의 근거를 다시 쓰면 새 관심종목을 심지 않고 그 행을 재사용해 `theses`에
// `version`이 오른 행을 하나 더 쌓는다. 읽기 계층(`fetchLatestTheses`)은 이미 항목당
// 최신 version만 고르므로 화면은 새 근거만 본다. `watchlist_items`는 한 컬럼도 건드리지
// 않는다 — `addedPrice`·`addedAt`은 처음 담은 날의 사실이고, `bought`인 종목은 근거를
// 고쳐 써도 `bought`로 남는다. 옛 thesis/critique/premises 행은 이력으로 남긴다.
// `removed`된 티커를 다시 담는 것은 재사용이 아니라 새로 담는 것이다 — 옛 `addedPrice`를
// 물려받으면 "담은 날 대비"(#86)가 거짓이 된다.
//
// premises.status 초기값: price/valuation은 다음 판정(S1 로드/S5 진입)을 기다리는
// "pending", fundamental/qualitative는 엔진이 건드리지 않는 "manual"
// (premises/engine.ts 상단 주석 참고).

import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
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
 *
 * 근거 갱신이면 돌려주는 항목의 식별자·`addedPrice`·`addedAt`·`status`는 **기존 행의
 * 것**이다. 호출부의 목록 캐시(`appendItem`)가 티커로 기존 카드를 갈아치우므로, 여기서
 * 새 값을 지어내면 S1이 담은 날 기준을 오늘로 리셋해 그린다.
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

    const existing = await findOwnedItem(sessionId, ticker);
    const watchlistItemId = existing?.id ?? randomUUID();
    const version = existing ? (await currentMaxVersion(existing.id)) + 1 : 1;
    const thesisId = randomUUID();
    // 재사용이면 담은 날은 이미 정해져 있다. `addedAt`이 비어 있던 옛 행은 loadItem과 같은
    // 규칙으로 `createdAt`을 쓴다.
    const addedAt = existing ? (existing.addedAt ?? existing.createdAt) : new Date();
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
      ...(existing
        ? []
        : [
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
          ]),
      db.insert(theses).values({
        id: thesisId,
        createdAt,
        watchlistItemId,
        version,
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
      name: existing?.name ?? stock.name,
      status: (existing?.status as SettledWatchlistItem["status"]) ?? "watching",
      isSeed: existing?.isSeed ?? false,
      addedPrice: existing?.addedPrice != null ? Number(existing.addedPrice) : quote.price,
      addedAt: addedAt.toISOString(),
      avgBuyPrice: existing?.avgBuyPrice != null ? Number(existing.avgBuyPrice) : undefined,
      boughtAt: existing?.boughtAt?.toISOString(),
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

/**
 * 세션이 소유한(watching|bought) 같은 티커의 관심종목 1건. 없으면 `undefined`.
 *
 * **먼저 담은 행을 고른다** — 이미 쌓인 중복이 있어도(#98 이전에 생긴 것) 담은 날 기준이
 * 가장 오래 산 행에 있다. `createdAt`이 같을 수 있으므로 `id`로 한 번 더 끊어, 같은 입력에
 * 두 번 물어 다른 답이 나오지 않게 한다.
 */
async function findOwnedItem(sessionId: string, ticker: string) {
  const [item] = await db
    .select()
    .from(watchlistItems)
    .where(
      and(
        eq(watchlistItems.sessionId, sessionId),
        eq(watchlistItems.ticker, ticker),
        inArray(watchlistItems.status, ["watching", "bought"])
      )
    )
    .orderBy(asc(watchlistItems.createdAt), asc(watchlistItems.id))
    .limit(1);
  return item;
}

/** 이 항목에 쌓인 근거의 현재 최대 version. 근거가 없으면 0 — 다음이 1이다. */
async function currentMaxVersion(watchlistItemId: string): Promise<number> {
  const [row] = await db
    .select({ version: theses.version })
    .from(theses)
    .where(eq(theses.watchlistItemId, watchlistItemId))
    .orderBy(desc(theses.version))
    .limit(1);
  return row?.version ?? 0;
}
