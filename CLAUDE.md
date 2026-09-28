# The Forum — Claude Code Rules

## Project Overview

Turborepo monorepo with:
- `apps/web` — Next.js 16 (App Router, Turbopack, Tailwind v4, shadcn/ui), Auth.js v5 + Princeton CAS login
- `apps/database` — Drizzle ORM + PostgreSQL
- `backends/fastapi` — FastAPI (Python 3.12, uv)

---

## Package Manager

**Always use `bun`.** Never use `npm`, `yarn`, or `pnpm`.

```bash
bun install          # install deps
bun add <pkg>        # add a dep
bun add -d <pkg>     # add a dev dep
bunx <tool>          # run a package binary
```

---

## Linting & Formatting

**Always use Biome.** Never add ESLint or Prettier.

```bash
bun run check        # lint + format (auto-fix)
bun run format       # format only
```

---

## Environment Variables (apps/web)

**Always use `~/src/env.ts` (T3 env) to access environment variables inside `apps/web`.
Never use `process.env.*` directly in Next.js application code.**

### Adding a new env var

1. Add it to `apps/web/src/env.ts`:
   - **Server-only** (no browser access) → goes in the `server:` block
   - **Client-side** (must start with `NEXT_PUBLIC_`) → goes in the `client:` block
   - Add a matching entry in `runtimeEnv:` pointing to `process.env.VAR_NAME`

2. Add it to `apps/web/.env.local.example` and to the root `.env.example`

3. Add it to your local `apps/web/.env.local`

### Usage in code

```ts
// ✅ Correct
import { env } from "~/env";
const url = env.DATABASE_URL;         // server component / API route
const api = env.NEXT_PUBLIC_API_URL;  // any component

// ❌ Wrong — never do this inside apps/web
const url = process.env.DATABASE_URL;
```

### Exceptions

`apps/database/src/db.ts` and `apps/database/drizzle.config.ts` are CLI/server-only
utilities — they may use `process.env` directly since they are not Next.js modules.

---

## UI Components (apps/web)

**Use shadcn/ui** for all UI components.

```bash
# Add a new shadcn component (run from apps/web)
bunx shadcn@latest add <component-name>
```

Components are placed in `apps/web/src/components/ui/`.
The `cn()` helper for class merging is at `apps/web/src/lib/utils.ts`.

---

## Database

```bash
bun run db:up        # start Postgres (Docker)
bun run db:push      # push schema changes (dev)
bun run db:generate  # generate SQL migration files
bun run db:migrate   # apply migrations
bun run db:studio    # open Drizzle Studio
```

Schema lives in `apps/database/src/schema/index.ts`.

---

## Turborepo Tasks

```bash
bun run dev          # start all services (TUI)
bun run build        # build all packages
bun run lint         # lint all packages
```
