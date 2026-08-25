import "server-only";
import { cookies } from "next/headers";
import { db } from "./index";
import { sessions } from "./schema";

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

export async function ensureSession(sessionId: string): Promise<void> {
  await db.insert(sessions).values({ id: sessionId }).onConflictDoNothing();
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
