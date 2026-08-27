// 일회성 백필 스크립트 (issue #65). 이미 프로비저닝된 기존 세션들의 시드 row는
// `provisionSeedItems`가 세션 최초 생성 시 한 번만 찍어낸 스냅샷이라, seed-data.ts/
// db/seed.ts의 상수를 고쳐도 자동으로 갱신되지 않는다. 이 스크립트가 그 간극을 메운다:
//
//   1. 기존 세션의 SK텔레콤/아모레퍼시픽 시드 row(가격 전제 statement/checkConfig,
//      addedPrice/avgBuyPrice)를 새 값으로 UPDATE한다. LG에너지솔루션은 thesis가
//      없어 손댈 게 없다.
//   2. 기존 세션 중 삼성전자(005930)/카카오페이(377300)가 아직 없는 세션에는
//      새 시드 row를 INSERT한다. 사용자가 이미 같은 티커를 직접 담았다면 skip한다.
//
// 실행: bun --env-file=.env.local -- scripts/backfill-seed-refresh.ts
// (로컬 DATABASE_URL로 먼저 검증한 뒤, 운영 DATABASE_URL로 다시 실행한다.)
//
// src/lib/db/index.ts의 "internal client, don't import outside src/lib/db" 규칙은
// 앱 런타임 코드 기준이다 — 이 스크립트는 앱 밖에서 한 번 실행되는 유지보수 도구라
// 예외로 직접 import한다.

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { critiques, premises, theses, watchlistItems } from "../src/lib/db/schema";
import { findDemoStock } from "../src/lib/mock/demo-whitelist";
import { SEED_ITEMS } from "../src/lib/mock/seed-data";

const SEED_D = SEED_ITEMS.find((s) => s.id === "seed-d")!;
const SEED_E = SEED_ITEMS.find((s) => s.id === "seed-e")!;
const NEW_SEED_ITEMS = [SEED_D, SEED_E];

// db/seed.ts의 SEED_PREMISE_CHECK_CONFIG와 동일한 값. 그쪽은 모듈 비공개 상수라
// 이 일회성 스크립트에 그대로 옮겨 적는다 — 새 세션 provisioning 로직과 반드시
// 같은 값을 유지해야 한다 (바뀌면 여기도 같이 바꿀 것).
const NEW_ITEM_PREMISE_CHECK_CONFIG: Record<string, { metric?: "per" | "pbr"; operator: "lte" | "gte"; value: number }> = {
  "seed-d-p1": { operator: "lte", value: 275_000 },
  "seed-e-p1": { operator: "lte", value: 48_500 },
};

const UPDATED_ITEM_FIELDS: Record<string, { addedPrice: number; avgBuyPrice?: number }> = {
  "017670": { addedPrice: 94_000, avgBuyPrice: 96_000 },
};

const UPDATED_PREMISES: Record<string, { checkType: string; statement: string; checkConfig: unknown }> = {
  "017670": {
    checkType: "price",
    statement: "10만 5,000원 이하일 때 저평가",
    checkConfig: { operator: "lte", value: 105_000 },
  },
  "090430": {
    checkType: "valuation",
    statement: "PER 44배 이하 유지",
    checkConfig: { metric: "per", operator: "lte", value: 44 },
  },
};

async function refreshExistingSeedItems() {
  for (const [ticker, fields] of Object.entries(UPDATED_ITEM_FIELDS)) {
    const items = await db
      .select({ id: watchlistItems.id })
      .from(watchlistItems)
      .where(and(eq(watchlistItems.isSeed, true), eq(watchlistItems.ticker, ticker)));

    for (const item of items) {
      await db
        .update(watchlistItems)
        .set({
          addedPrice: String(fields.addedPrice),
          avgBuyPrice: fields.avgBuyPrice != null ? String(fields.avgBuyPrice) : null,
        })
        .where(eq(watchlistItems.id, item.id));
    }
    console.log(`watchlist_items: ${ticker} × ${items.length}건 addedPrice/avgBuyPrice 갱신`);
  }

  for (const [ticker, update] of Object.entries(UPDATED_PREMISES)) {
    const items = await db
      .select({ id: watchlistItems.id })
      .from(watchlistItems)
      .where(and(eq(watchlistItems.isSeed, true), eq(watchlistItems.ticker, ticker)));

    let updatedCount = 0;
    for (const item of items) {
      const [latestThesis] = await db
        .select({ id: theses.id })
        .from(theses)
        .where(eq(theses.watchlistItemId, item.id))
        .orderBy(desc(theses.version))
        .limit(1);
      if (!latestThesis) continue;

      const result = await db
        .update(premises)
        .set({ statement: update.statement, checkConfig: update.checkConfig })
        .where(and(eq(premises.thesisId, latestThesis.id), eq(premises.checkType, update.checkType)));
      updatedCount += result.rowCount ?? 0;
    }
    console.log(`premises: ${ticker} ${update.checkType} 전제 ${updatedCount}건 statement/checkConfig 갱신`);
  }
}

async function insertMissingSeedItems() {
  const sessions = await db.select({ sessionId: watchlistItems.sessionId }).from(watchlistItems).groupBy(watchlistItems.sessionId);
  const sessionIds = [...new Set(sessions.map((s) => s.sessionId))];

  for (const seed of NEW_SEED_ITEMS) {
    const stock = findDemoStock(seed.ticker);
    if (!stock) throw new Error(`Unknown seed ticker: ${seed.ticker}`);

    let inserted = 0;
    let skipped = 0;

    for (const sessionId of sessionIds) {
      const existing = await db
        .select({ id: watchlistItems.id })
        .from(watchlistItems)
        .where(and(eq(watchlistItems.sessionId, sessionId), eq(watchlistItems.ticker, seed.ticker)))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const watchlistItemId = randomUUID();
      const queries: unknown[] = [
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
        }),
      ];

      if (seed.thesis) {
        const thesisId = randomUUID();
        queries.push(
          db.insert(theses).values({
            id: thesisId,
            watchlistItemId,
            category: seed.thesis.category,
            followup: seed.thesis.followup,
            freeText: seed.thesis.freeText ?? null,
            createdAt: new Date(seed.thesis.createdAt),
          }),
          db.insert(critiques).values({
            thesisId,
            isChallengeable: seed.thesis.critique.isChallengeable,
            counterpoints: seed.thesis.critique.counterpoints,
            openQuestions: seed.thesis.critique.openQuestions,
          }),
          db.insert(premises).values(
            seed.thesis.premises.map((p) => ({
              thesisId,
              statement: p.base.statement,
              checkType: p.base.checkType,
              checkConfig: NEW_ITEM_PREMISE_CHECK_CONFIG[p.base.id] ?? null,
              status: p.current.status,
              observedValue: p.current.observedValue ?? null,
            }))
          )
        );
      }

      await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
      inserted++;
    }

    console.log(`${stock.name}(${seed.ticker}): ${inserted}개 세션에 신규 삽입, ${skipped}개 세션은 이미 보유해 skip`);
  }
}

async function main() {
  await refreshExistingSeedItems();
  await insertMissingSeedItems();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
