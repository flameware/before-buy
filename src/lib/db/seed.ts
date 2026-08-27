import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./index";
import { critiques, premises, theses, watchlistItems } from "./schema";
import { SEED_ITEMS } from "../mock/seed-data";
import { findStock } from "../mock/stock-universe";
import type { PremiseCheckConfig } from "../mock/types";

/**
 * 시드 전제 중 price/valuation 타입의 자동 판정 설정. 시드 A/B/D/E의 문구(예: "10만
 * 5,000원 이하일 때 저평가")를 엔진이 읽을 수 있는 {kind,metric,value}로 고정
 * 매핑한다 — qualitative 전제(seed-b-p3)는 자동 판정 대상이 아니므로 여기 없다.
 *
 * 방향은 `kind`가 결정한다 (ADR-0007). 이전에는 여기서 `operator`를 직접 골랐고,
 * 그 탓에 "목표가 210,000원"이 `lte`로 적혀 도달 목표가 유지 조건처럼 판정됐다.
 *
 * 임계값은 2026-08-26 KIS 실측가 × 1.05(반올림) 기준으로 잡았다 — issue #65.
 * 절대값 비교라 시세가 이 범위를 다시 넘으면 또 깨질 수 있다는 건 알고 감수한다.
 */
const SEED_PREMISE_CHECK_CONFIG: Record<string, PremiseCheckConfig> = {
  "seed-a-p1": { kind: "value-ceiling", value: 105_000 },
  "seed-b-p1": { kind: "value-ceiling", metric: "per", value: 44 },
  "seed-b-p2": { kind: "target-price", value: 210_000 },
  "seed-d-p1": { kind: "value-ceiling", value: 275_000 },
  "seed-e-p1": { kind: "value-ceiling", value: 48_500 },
};

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
