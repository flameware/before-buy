import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./index";
import { critiques, premises, theses, watchlistItems } from "./schema";
import { SEED_ITEMS, SEED_PREMISE_CHECK_CONFIG } from "../mock/seed-data";
import { findDemoStock } from "../mock/demo-whitelist";

/**
 * 시드 A/B/C/D/E를 세션의 실제 row로 심는다. DB에는 "현재" 값만 저장한다 — "3개월 후"
 * 값은 `seed-data.ts`에 코드 상수로 남아, 판정 엔진이 데모 토글(isFuture)을 받았을 때
 * 시드 티커에 한해 그쪽을 참조한다 (지도 Destination 참고).
 *
 * 한 번의 `db.batch` 호출로 전체를 심어, 세션당 한 번뿐인 이 삽입이 부분 실패로
 * 반쪽짜리 상태(예: watchlist_items는 있는데 thesis가 없는)를 남기지 않게 한다.
 */
export async function provisionSeedItems(sessionId: string): Promise<void> {
  const queries: unknown[] = [];

  for (const seed of SEED_ITEMS) {
    // 시드는 손으로 고른 종목이므로 언제나 데모 화이트리스트 안에 있다 — 여기서
    // 못 찾으면 시드 정의가 깨진 것이라 던지는 게 맞다 (검색 경로와 달리).
    const stock = findDemoStock(seed.ticker);
    if (!stock) throw new Error(`Unknown seed ticker: ${seed.ticker}`);

    const watchlistItemId = randomUUID();
    queries.push(
      db.insert(watchlistItems).values({
        id: watchlistItemId,
        sessionId,
        ticker: seed.ticker,
        name: stock.name,
        status: seed.status,
        addedPrice: String(seed.addedPrice),
        addedAt: new Date(seed.addedAt),
        avgBuyPrice: seed.avgBuyPrice != null ? String(seed.avgBuyPrice) : null,
        boughtAt: seed.boughtAt ? new Date(seed.boughtAt) : null,
        isSeed: true,
      })
    );

    if (!seed.thesis) continue;

    const thesisId = randomUUID();
    queries.push(
      db.insert(theses).values({
        id: thesisId,
        watchlistItemId,
        category: seed.thesis.category,
        followup: seed.thesis.followup,
        freeText: seed.thesis.freeText ?? null,
        createdAt: new Date(seed.thesis.createdAt),
      })
    );

    queries.push(
      db.insert(critiques).values({
        thesisId,
        isChallengeable: seed.thesis.critique.isChallengeable,
        counterpoints: seed.thesis.critique.counterpoints,
        openQuestions: seed.thesis.critique.openQuestions,
      })
    );

    queries.push(
      db.insert(premises).values(
        seed.thesis.premises.map((p) => ({
          thesisId,
          statement: p.base.statement,
          checkType: p.base.checkType,
          checkConfig: SEED_PREMISE_CHECK_CONFIG[p.base.id] ?? null,
          status: p.current.status,
          observedValue: p.current.observedValue ?? null,
        }))
      )
    );
  }

  await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
}
