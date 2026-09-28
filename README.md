# The Forum

Princeton's campus events platform, built by [TigerApps](https://tigerapps.org).

This is a [Turborepo](https://turbo.build) monorepo managed with [Bun](https://bun.sh):

| Package | What it is |
|---|---|
| `apps/web` | **The main app** — Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui |
| `apps/database` | Shared Drizzle ORM schema + migrations (PostgreSQL) |
| `packages/inbox-engine` | **Git submodule** → [TigerAppsOrg/InboxEngine](https://github.com/TigerAppsOrg/InboxEngine), the shared source of truth for Princeton organizations, campus venues and events (MyPrincetonU + listserv emails) |

New to the project? Follow **Quick start** below — it gets `apps/web` running locally,
which is the primary thing you need.

Clone with submodules (`git clone --recurse-submodules …`), or run
`git submodule update --init` in an existing checkout. InboxEngine is a private repo;
ask a TigerApps admin for access if the submodule fails to fetch.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| [Bun](https://bun.sh) | ≥ 1.2 | macOS/Linux: `curl -fsSL https://bun.sh/install \| bash` · Windows: `powershell -c "irm bun.sh/install.ps1 \| iex"` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | latest | docker.com (used only for local Postgres) |
| [Git](https://git-scm.com) | ≥ 2.40 | Pre-installed on macOS; `winget install Git.Git` on Windows |
| [uv](https://docs.astral.sh/uv/) | ≥ 0.5 | Only needed for the Python backend — see [Python backend](#python-backend-optional) |

> **Windows:** use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) or Git Bash
> for all commands below. Restart your terminal after installing tools so PATH updates apply.

**Never use `npm`, `yarn`, or `pnpm` in this repo — always `bun`.**

---

## Quick start (`apps/web`)

### 1. Clone and install

```bash
git clone https://github.com/TigerAppsOrg/TheForum.git
cd TheForum
bun install   # installs every workspace package + sets up Husky pre-commit hooks
```

### 2. Environment variables

Copy the example files:

```bash
cp .env.example .env                                  # root — used by docker-compose
cp apps/web/.env.local.example apps/web/.env.local    # Next.js app
cp apps/database/.env.example apps/database/.env      # drizzle-kit CLI
```

Then fill in `apps/web/.env.local`. Env vars are validated at startup by
[`apps/web/src/env.ts`](apps/web/src/env.ts) — the app won't boot if a required
one is missing, and that file is the source of truth for what's required.

> **Can't obtain a value yourself? Ask Ibraheem.** He is the contact for all
> credentials that aren't self-serve (Mapbox tokens, AWS, etc.).

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Default in the example file works as-is with the Docker database (port **5434**) |
| `AUTH_SECRET` | Generate your own: `openssl rand -base64 32` |
| `AUTH_URL` | Optional locally. **Required in production:** the app's canonical public URL (e.g. `https://forum.example.edu`) — pins Auth.js callbacks and the CAS service URL to that origin |
| `AUTH_TRUST_HOST` | Optional. Set to `true` only when running behind a reverse proxy without `AUTH_URL` (not needed on Vercel, which Auth.js trusts automatically) |
| `CAS_BASE_URL` | Optional — defaults to `https://fed.princeton.edu/cas/` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` / `NEXT_PUBLIC_CAMPUS_MAP_TOKEN` / `NEXT_PUBLIC_CAMPUS_MAP_STYLE` | **Ask Ibraheem** — Mapbox tokens + the Princeton campus map style URL |
| `AWS_S3_BUCKET` / `AWS_REGION` | Optional (image uploads) — ask Ibraheem if you're working on that feature |

Login uses **Princeton CAS** — there are no OAuth client credentials to obtain.
Clicking "Log in" goes to `/api/auth/cas/login`, which redirects to
`fed.princeton.edu/cas`; CAS sends you back to `/api/auth/cas/callback`, where the
ticket is validated server-side and your user row is created from your NetID.

### 3. Start the database

Make sure **Docker Desktop is running**, then from the repo root:

```bash
bun run db:up      # starts Postgres 17 in Docker (container: the-forum-db, host port 5434)
bun run db:push    # push the Drizzle schema into the fresh database
```

Sanity checks:

```bash
docker compose ps   # the-forum-db should show "Up (healthy)"
bun run db:logs     # tail the Postgres logs if something looks wrong
```

The database URL is `postgresql://forum:forum_password@localhost:5434/the_forum`
(also reachable with any Postgres client, e.g. `psql`, TablePlus, or `bun run db:studio`).

Optionally fill the database with realistic demo data:

```bash
bun run db:seed
```

### 4. Run the app

```bash
cd apps/web && bun run dev
```

Open <http://localhost:3000>. You're set up.

To run the dev server through Turborepo from the repo root: `bun run dev`.

---

## Everyday commands

```bash
bun run check        # Biome lint + format with auto-fix (run before pushing)
bun run format       # format only
bun run build        # build all packages

bun run db:up        # start Postgres        db:down     stop it (data persists)
bun run db:push      # push schema (dev)     db:generate generate SQL migrations
bun run db:migrate   # apply migrations      db:studio   visual DB browser
bun run db:seed      # seed demo data (safe to re-run; refuses non-local DBs unless ALLOW_REMOTE_SEED=1)
bun run db:sync-engine  # import orgs, venues and events from InboxEngine (needs INBOX_ENGINE_URL/TOKEN)
(cd apps/web && bun test)   # unit tests
```

Pre-commit hooks (Husky + lint-staged) automatically run Biome on staged files —
if your commit fails, read the Biome output, fix, and re-commit.

### Conventions

- **Env vars in `apps/web`:** always `import { env } from "~/env"` — never `process.env.*` directly.
  New vars get added to `apps/web/src/env.ts` *and* the `.env.example` files.
- **UI components:** use [shadcn/ui](https://ui.shadcn.com). Add new ones from `apps/web`:
  `bunx shadcn@latest add <component>`.
- **Linting:** Biome only (no ESLint/Prettier).

---

## Organizations and events from InboxEngine

Official organizations (all MyPrincetonU groups, with logos, descriptions, social links and
MyPrincetonU page links), campus venues and events come from
[InboxEngine](https://github.com/TigerAppsOrg/InboxEngine), which also powers TigerInbox.
It ingests MyPrincetonU's official events feed and residential/FreeFood listserv emails,
resolves the hosting organization, extracts time and place, and exposes a revisioned change feed.

```bash
# apps/database/.env
INBOX_ENGINE_URL=https://inbox-engine.tigerapps.org
INBOX_ENGINE_TOKEN=…            # ask a TigerApps admin

bun run db:sync-engine          # incremental; add -- --full to replay the whole feed
```

Imported orgs have `source = 'myprincetonu'` and `external_id = 'mpu:<group id>'`; their
officers are managed on MyPrincetonU. Imported events are owned by the `_inboxengine` bot user,
carry `source` (`myprincetonu` or `listserv`) and a `source_url`, and are unpublished (never
deleted) when InboxEngine withdraws them. Production runs the sync every five minutes.

To update the engine version: `cd packages/inbox-engine && git pull origin main`, then commit
the new submodule pointer.

---

## Branching workflow

`main` is protected — you cannot push to it directly, and pull requests into `main`
are only accepted from `staging`.

1. Branch off `main`: `git checkout -b feat/my-feature origin/main`
2. Open a PR **into `staging`** and merge it there
3. When `staging` is ready to ship, open a PR from `staging` into `main`

---

## Troubleshooting

**The app crashes on startup with "Invalid environment variables"**
A required var in `apps/web/.env.local` is missing or malformed — compare against
`apps/web/.env.local.example` and the table above.

**`ECONNREFUSED` / `DATABASE_URL` errors**
The database container isn't running (`bun run db:up`), or your `DATABASE_URL`
uses the wrong port — the Docker database listens on **5434**, not 5432.

**Port 5434 already in use**
Change `POSTGRES_PORT` in the root `.env` and update `DATABASE_URL` everywhere to match.

**Husky hooks not running**
Re-run `bun install` from the repo root (the `prepare` script reinstalls hooks).

**Wipe the database and start fresh**
`docker compose down -v` (deletes the data volume), then `bun run db:up && bun run db:push && bun run db:seed`.
