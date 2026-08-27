// S3 fallback: draft가 없을 때(예: 시드 종목으로 직접 진입) 이미 DB에 있는 thesis를
// 그대로 읽는다. 시드는 세션 생성 시 이미 provisionSeedItems로 심어져 있으므로 새로
// 생성할 필요 없이 단순 조회로 충분하다 (지도 #38 이슈 #47).

import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { critiques, premises, theses, watchlistItems } from "@/lib/db/schema";
import { withSession } from "@/lib/db/session";
import type { Critique, FollowupAnswer, Premise, Thesis } from "@/lib/mock/types";

export async function getExistingThesis(ticker: string): Promise<Thesis | null> {
  return withSession(async (sessionId) => {
    // 세션 소유(watching|bought)만 본다 — `status` 필터가 없던 동안에는 제외한 종목의
    // 근거가 이 fallback으로 되살아날 수 있었다. 정렬도 명시한다: 정렬 없는 "첫 행"은
    // 옛 중복(#98)이 남아 있을 때 같은 질문에 다른 답을 준다.
    const [item] = await db
      .select({ id: watchlistItems.id })
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
    if (!item) return null;

    const [thesisRow] = await db
      .select()
      .from(theses)
      .where(eq(theses.watchlistItemId, item.id))
      .orderBy(desc(theses.version))
      .limit(1);
    if (!thesisRow) return null;

    const [premiseRows, critiqueRows] = await Promise.all([
      db.select().from(premises).where(eq(premises.thesisId, thesisRow.id)),
      db.select().from(critiques).where(eq(critiques.thesisId, thesisRow.id)),
    ]);

    const critique: Critique = critiqueRows[0]
      ? {
          isChallengeable: critiqueRows[0].isChallengeable,
          counterpoints: (critiqueRows[0].counterpoints as Critique["counterpoints"]) ?? [],
          openQuestions: (critiqueRows[0].openQuestions as string[]) ?? [],
        }
      : { isChallengeable: false, counterpoints: [], openQuestions: [] };

    const premisesList: Premise[] = premiseRows.map((p) => ({
      id: p.id,
      statement: p.statement,
      checkType: p.checkType as Premise["checkType"],
      status: p.status as Premise["status"],
      observedValue: p.observedValue ?? undefined,
    }));

    return {
      category: thesisRow.category as Thesis["category"],
      followup: (thesisRow.followup as FollowupAnswer[]) ?? [],
      freeText: thesisRow.freeText ?? undefined,
      createdAt: thesisRow.createdAt.toISOString(),
      critique,
      premises: premisesList,
    };
  });
}
