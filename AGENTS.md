# The Forum — Agent Rules

## Project Overview

Turborepo monorepo with:
- `apps/web` — Next.js 16 (App Router, Turbopack, Tailwind v4, shadcn/ui), Auth.js v5 + Princeton CAS login
- `apps/database` — Drizzle ORM + PostgreSQL
- `packages/inbox-engine` — git submodule (TigerAppsOrg/InboxEngine): shared org/venue/event source of truth; sync with `bun run db:sync-engine`. Don't edit it here — change InboxEngine and bump the submodule.

---

## Workflow

- Before starting work, read the relevant Linear issue and project guidance when Linear access is available. Use the issue ID and scope to guide the branch name and implementation. If Linear is unavailable, say so and work from the provided context.

- Start branches for changes from the latest `staging`. `main` is the production branch.
- Name branches `<first-name>_<mm-dd>_<ticket-id>[-optional-descriptors]`, using the date the branch is created. Example: `alex_10-27_TIG-123-update-feed`. Linear's generated Git branch name is also acceptable. For work without a Linear issue, use a descriptive name in place of the ticket ID, such as `alex_10-27_agent-workflow`.
- Keep `AGENTS.md` and `CLAUDE.md` identical. They are separate regular files for portability across Windows checkouts; whenever either file changes, repeat the same changes in the other file in the same commit.

### Linear description edits

When proposing a change to a Linear issue description, preserve the full original description in the issue itself. Append a horizontal separator (`---`), then a clearly labeled `Proposed description` section containing the full new description. Keep the original intact so others can review the proposal before accepting the change; do not replace the original with the proposal before acceptance.

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
