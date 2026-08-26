import "server-only";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "./index";
import { kisTokens } from "./schema";

// Persists the KIS OAuth access token across serverless instances (issue #59).
// The Neon HTTP driver has no transaction/row-lock support, so refresh
// serialization is done with a single atomic upsert (Postgres runs one
// statement as an implicit transaction) rather than SELECT ... FOR UPDATE.
const REFRESH_CLAIM_TIMEOUT_MS = 30_000;

export async function readValidToken(
  key: string
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  const [row] = await db
    .select({ accessToken: kisTokens.accessToken, expiresAt: kisTokens.expiresAt })
    .from(kisTokens)
    .where(and(eq(kisTokens.key, key), gt(kisTokens.expiresAt, new Date())));

  if (!row || !row.accessToken || !row.expiresAt) return null;
  return { accessToken: row.accessToken, expiresAt: row.expiresAt };
}

// Wins the right to call KIS's token endpoint for `key`; false means another
// instance already holds the claim (or just refreshed) — re-check readValidToken.
export async function claimTokenRefresh(key: string): Promise<boolean> {
  const staleClaim = new Date(Date.now() - REFRESH_CLAIM_TIMEOUT_MS);

  const [claimed] = await db
    .insert(kisTokens)
    .values({ key, refreshingSince: new Date() })
    .onConflictDoUpdate({
      target: kisTokens.key,
      set: { refreshingSince: new Date() },
      setWhere: and(
        or(isNull(kisTokens.expiresAt), lt(kisTokens.expiresAt, new Date())),
        or(isNull(kisTokens.refreshingSince), lt(kisTokens.refreshingSince, staleClaim))
      ),
    })
    .returning({ key: kisTokens.key });

  return !!claimed;
}

export async function saveToken(
  key: string,
  accessToken: string,
  expiresAt: Date
): Promise<void> {
  await db
    .insert(kisTokens)
    .values({ key, accessToken, expiresAt, refreshingSince: null })
    .onConflictDoUpdate({
      target: kisTokens.key,
      set: { accessToken, expiresAt, refreshingSince: null },
    });
}
