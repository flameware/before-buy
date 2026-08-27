// 일회성 정리 스크립트 (issue #88). ADR-0007이 `check_config`의 계약을
// `{operator,...}`에서 `{kind,...}`로 바꾸면서 "기존 세션 행은 폐기한다"고 결정했지만,
// 그 폐기를 실행하는 코드가 없었다. 그래서 마이그레이션 이전에 심긴 행이 그대로 남아
// `parseCheckConfig`가 방향을 못 읽고 → 자동 전제가 영구 `unreadable`이 됐다.
//
// 대상은 `check_type`이 price|valuation인데 `check_config`에서 `kind`를 읽을 수 없는 행.
// 두 갈래로 처리한다:
//
//   1. **시드 종목** — `SEED_PREMISE_CHECK_CONFIG`의 statement→kind 매핑으로 UPDATE해
//      복구한다. ADR-0007이 거부한 "`operator`에서 역추론"이 아니다. 그 `operator`가
//      틀렸다는 게 결함의 내용이라 원본으로 쓸 수 없지만, 시드 상수는 사람이 새 어휘로
//      다시 쓴 권위 있는 값이라 그대로 덮어쓰면 된다.
//   2. **사용자가 만든 전제** — 정답이 어디에도 없으므로 그 전제 행만 DELETE한다. 근거
//      본문과 같은 근거의 다른 전제(직접 확인 등)는 건드리지 않는다. 사용자는 S5의
//      "생각 업데이트 하기"로 다시 쓸 수 있고, 그때는 `kind`를 강제하는 지금 경로를 탄다.
//
// 실행: bun --env-file=.env.local -- scripts/repair-legacy-check-config.ts [--apply]
// `--apply` 없이 돌리면 영향 받는 행만 세어 보여주고 아무것도 쓰지 않는다.
// (로컬 DATABASE_URL로 먼저 검증한 뒤, 운영 DATABASE_URL로 다시 실행한다.)
//
// src/lib/db/index.ts의 "internal client, don't import outside src/lib/db" 규칙은
// 앱 런타임 코드 기준이다 — 이 스크립트는 앱 밖에서 한 번 실행되는 유지보수 도구라
// 예외로 직접 import한다.

import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db";
import { premises, theses, watchlistItems } from "../src/lib/db/schema";
import { parseCheckConfig } from "../src/lib/premises/engine";
import { SEED_ITEMS, SEED_PREMISE_CHECK_CONFIG } from "../src/lib/mock/seed-data";
import type { PremiseCheckConfig } from "../src/lib/mock/types";

const APPLY = process.argv.includes("--apply");

const AUTO_CHECK_TYPES = new Set(["price", "valuation"]);

/**
 * 시드 전제를 statement로 찾을 수 있게 뒤집어 둔다. DB의 premises 행은 seed-data의
 * `seed-a-p1` 같은 id를 갖지 않고 (provisioning이 uuid를 새로 찍는다) statement만
 * 그대로 옮겨 담기 때문에, 그 문장이 시드 행을 되짚는 유일한 열쇠다.
 */
function seedConfigByStatement(): Map<string, PremiseCheckConfig> {
  const byStatement = new Map<string, PremiseCheckConfig>();
  for (const seed of SEED_ITEMS) {
    for (const p of seed.thesis?.premises ?? []) {
      const config = SEED_PREMISE_CHECK_CONFIG[p.base.id];
      if (config) byStatement.set(p.base.statement, config);
    }
  }
  return byStatement;
}

async function main() {
  const rows = await db
    .select({
      id: premises.id,
      statement: premises.statement,
      checkType: premises.checkType,
      checkConfig: premises.checkConfig,
      ticker: watchlistItems.ticker,
      isSeed: watchlistItems.isSeed,
    })
    .from(premises)
    .innerJoin(theses, eq(premises.thesisId, theses.id))
    .innerJoin(watchlistItems, eq(theses.watchlistItemId, watchlistItems.id));

  // 앱이 실제로 쓰는 파서로 거른다 — "읽을 수 없다"의 정의가 화면과 어긋나지 않게.
  const broken = rows.filter(
    (r) => AUTO_CHECK_TYPES.has(r.checkType) && parseCheckConfig(r.checkConfig)?.kind == null
  );

  console.log(`전체 전제 ${rows.length}건 중 방향(kind)을 읽을 수 없는 자동 전제 ${broken.length}건`);
  if (broken.length === 0) return;

  const seedConfig = seedConfigByStatement();
  const repairable: { id: string; config: PremiseCheckConfig; label: string }[] = [];
  const deletable: typeof broken = [];

  for (const row of broken) {
    const config = row.isSeed ? seedConfig.get(row.statement) : undefined;
    if (config) {
      repairable.push({ id: row.id, config, label: `${row.ticker} "${row.statement}"` });
    } else {
      // 시드인데 매핑에 없는 경우도 여기로 온다 — 시드 문구가 바뀐 뒤 남은 행이라
      // 정답을 알 수 없는 건 사용자 전제와 같다.
      deletable.push(row);
    }
  }

  console.log(`\n복구(시드) ${repairable.length}건:`);
  for (const r of repairable) console.log(`  ${r.label} → kind=${r.config.kind}`);

  console.log(`\n삭제(사용자) ${deletable.length}건:`);
  for (const r of deletable) console.log(`  ${r.ticker} "${r.statement}" (${r.checkType})`);

  if (!APPLY) {
    console.log("\n--apply 없이 실행했습니다. 아무것도 쓰지 않았습니다.");
    return;
  }

  for (const r of repairable) {
    await db.update(premises).set({ checkConfig: r.config }).where(eq(premises.id, r.id));
  }
  if (deletable.length > 0) {
    await db.delete(premises).where(inArray(premises.id, deletable.map((r) => r.id)));
  }

  console.log(`\n복구 ${repairable.length}건, 삭제 ${deletable.length}건 완료.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
