/**
 * Apply Drizzle SQL migrations (apps/database/drizzle) with drizzle-orm's migrator.
 * Used by deployments, where drizzle-kit isn't installed; bundled by deploy/build-release.sh.
 *   DATABASE_URL=… MIGRATIONS_DIR=… bun tools/migrate.js
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? new URL("../drizzle", import.meta.url).pathname;

const client = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(client), { migrationsFolder });
await client.end();
console.log(`Migrations applied from ${migrationsFolder}`);
