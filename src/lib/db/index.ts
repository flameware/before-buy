import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Internal client — do not import outside `src/lib/db/`.
 * All DB access goes through `session.ts`, which forces a `session_id`.
 */
export const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
