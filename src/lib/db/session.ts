import "server-only";
import { cookies } from "next/headers";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "./index";
import { sessions } from "./schema";
import { provisionSeedItems } from "./seed";

const SESSION_COOKIE = "session_id";
const LLM_CALL_LIMIT = 20;

/**
 * Reads the session id set by `proxy.ts`. Never call `db` directly with a
 * client-supplied id — this is the only place a session id is trusted.
 */
export async function getSessionId(): Promise<string> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    throw new Error(
      "session_id cookie missing — proxy.ts should have set it on every request"
    );
  }
  return sessionId;
}

/**
 * Inserts the session row if it doesn't exist yet. A row actually being
 * inserted (not skipped by the conflict) is how we know this session is
 * brand new, so we provision the seed watchlist items right here — no
 * separate "already seeded?" check against `is_seed` needed.
 */
export async function ensureSession(sessionId: string): Promise<void> {
  const [inserted] = await db
    .insert(sessions)
    .values({ id: sessionId })
    .onConflictDoNothing()
    .returning({ id: sessions.id });

  if (inserted) {
    await provisionSeedItems(sessionId);
  }
}

/**
 * Single entry point for session-scoped DB access. `fn` receives the
 * caller's own session id and cannot reach `db` without it.
 */
/**
 * Atomically increments `sessions.llm_call_count` iff it's still under the cap,
 * in one round trip — avoids a read-then-write race between concurrent requests
 * on the same session. Returns false (without incrementing) once the cap is hit.
 * Failed Anthropic calls still count: the counter tracks calls attempted, not
 * calls that succeeded, matching the spec's intent of bounding API spend.
 */
export async function incrementLlmCallCount(sessionId: string): Promise<boolean> {
  const [updated] = await db
    .update(sessions)
    .set({ llmCallCount: sql`${sessions.llmCallCount} + 1` })
    .where(and(eq(sessions.id, sessionId), lt(sessions.llmCallCount, LLM_CALL_LIMIT)))
    .returning({ id: sessions.id });

  return !!updated;
}

export async function withSession<T>(
  fn: (sessionId: string) => Promise<T>
): Promise<T> {
  const sessionId = await getSessionId();
  await ensureSession(sessionId);
  return fn(sessionId);
}
