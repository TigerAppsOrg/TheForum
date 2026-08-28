import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

/*
 * Cached on globalThis so hot reloads reuse one pool.
 *
 * Next dev re-evaluates this module on every HMR pass. Without the cache each
 * reload opened a brand-new pool and leaked the previous one, so a long editing
 * session walked straight into Postgres's 100-connection ceiling and every
 * query — including the auth session lookup — started failing with
 * `53300: too many clients already`.
 */
const globalForDb = globalThis as unknown as { __forumDbClient?: ReturnType<typeof postgres> };

// Disable prefetch as it is not supported for "Transaction" pool mode
const client =
  globalForDb.__forumDbClient ??
  postgres(process.env.DATABASE_URL, {
    prepare: false,
    // Bounded so one process can't monopolise the server's connection slots.
    max: 10,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__forumDbClient = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
