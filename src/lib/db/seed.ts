import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./index";
import { critiques, premises, theses, watchlistItems } from "./schema";
import { SEED_ITEMS } from "../mock/seed-data";
import { findStock } from "../mock/stock-universe";

/**
 * 시드 전제 중 price/valuation 타입의 자동 판정 설정. 시드 A/B의 문구(예: "3만 2,000원
 * 이하일 때 저평가")를 엔진이 읽을 수 있는 {metric,operator,value}로 고정 매핑한다 —
 * qualitative 전제(seed-b-p3)는 자동 판정 대상이 아니므로 여기 없다.
 */
const SEED_PREMISE_CHECK_CONFIG: Record<string, { metric?: "per" | "pbr"; operator: "lte" | "gte"; value: number }> = {
  "seed-a-p1": { operator: "lte", value: 32_000 },
  "seed-b-p1": { metric: "per", operator: "lte", value: 15 },
  "seed-b-p2": { operator: "lte", value: 210_000 },
};

/**
 * 시드 A/B/C를 세션의 실제 row로 심는다. DB에는 "현재" 값만 저장한다 — "3개월 후"
 * 값은 `seed-data.ts`에 코드 상수로 남아, 판정 엔진이 데모 토글(isFuture)을 받았을 때
 * 시드 티커에 한해 그쪽을 참조한다 (지도 Destination 참고).
 *
 * 한 번의 `db.batch` 호출로 전체를 심어, 세션당 한 번뿐인 이 삽입이 부분 실패로
 * 반쪽짜리 상태(예: watchlist_items는 있는데 thesis가 없는)를 남기지 않게 한다.
 */
export async function provisionSeedItems(sessionId: string): Promise<void> {
  const queries: unknown[] = [];

  for (const seed of SEED_ITEMS) {
    const stock = findStock(seed.ticker);
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
