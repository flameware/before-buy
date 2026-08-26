import "server-only";
import { cookies } from "next/headers";
import { db } from "./index";
import { sessions } from "./schema";
import { provisionSeedItems } from "./seed";

const SESSION_COOKIE = "session_id";

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
export async function withSession<T>(
  fn: (sessionId: string) => Promise<T>
): Promise<T> {
  const sessionId = await getSessionId();
  await ensureSession(sessionId);
  return fn(sessionId);
}
