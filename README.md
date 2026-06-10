# The Forum

Princeton's campus events platform, built by [TigerApps](https://tigerapps.org).

This is a [Turborepo](https://turbo.build) monorepo managed with [Bun](https://bun.sh):

| Package | What it is |
|---|---|
| `apps/web` | **The main app** — Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui |
| `apps/database` | Shared Drizzle ORM schema + migrations (PostgreSQL) |
| `apps/admin-web` | Admin dashboard — Vite + React |
| `backends/fastapi` | FastAPI backend (Python 3.12, managed with `uv`) |
| `apps/listserv-scraper` | Python scraper for Princeton listserv archives |
| `apps/mpu-scraper` | Scraper for MyPrincetonU events |

New to the project? Follow **Quick start** below — it gets `apps/web` running locally,
which is the primary thing you need. The Python backend and scrapers are optional
until you work on them.

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

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Default in the example file works as-is with the Docker database (port **5434**) |
| `AUTH_SECRET` | Generate your own: `openssl rand -base64 32` |
| `AUTH_AZURE_AD_CLIENT_ID` / `AUTH_AZURE_AD_CLIENT_SECRET` | **Ask the project lead (Ibraheem)** — these are the Microsoft Entra ID app credentials for Princeton CAS login |
| `AUTH_AZURE_AD_TENANT_ID` | Princeton's tenant ID — already filled in the example file |
| `NEXT_PUBLIC_MAPBOX_TOKEN` / `NEXT_PUBLIC_CAMPUS_MAP_TOKEN` / `NEXT_PUBLIC_CAMPUS_MAP_STYLE` | **Ask the project lead (Ibraheem)** — Mapbox tokens + the Princeton campus map style URL |
| `AWS_S3_BUCKET` / `AWS_REGION` | Optional (image uploads) — ask if you're working on that feature |

### 3. Start the database

```bash
bun run db:up      # starts Postgres 17 in Docker (container: the-forum-db, host port 5434)
bun run db:push    # push the Drizzle schema into the fresh database
```

Sanity checks: `docker compose ps` should show the container healthy;
`bun run db:logs` tails its logs. The database URL is
`postgresql://forum:forum_password@localhost:5434/the_forum`.

### 4. Run the app

```bash
cd apps/web && bun run dev
```

Open <http://localhost:3000>. You're set up.

To run **everything at once** (web + admin + FastAPI) from the repo root:

```bash
bun run dev        # Turborepo TUI: web :3000, admin-web :5173, FastAPI :8000
```

(FastAPI will only start if you've done the [Python backend](#python-backend-optional) setup.)

---

## Everyday commands

```bash
bun run check        # Biome lint + format with auto-fix (run before pushing)
bun run format       # format only
bun run build        # build all packages

bun run db:up        # start Postgres        db:down     stop it (data persists)
bun run db:push      # push schema (dev)     db:generate generate SQL migrations
bun run db:migrate   # apply migrations      db:studio   visual DB browser
```

Pre-commit hooks (Husky + lint-staged) automatically run Biome on staged files —
if your commit fails, read the Biome output, fix, and re-commit.

### Conventions

- **Env vars in `apps/web`:** always `import { env } from "~/env"` — never `process.env.*` directly.
  New vars get added to `apps/web/src/env.ts` *and* the `.env.example` files.
- **UI components:** use [shadcn/ui](https://ui.shadcn.com). Add new ones from `apps/web`:
  `bunx shadcn@latest add <component>`.
- **Linting:** Biome only (no ESLint/Prettier). Python uses Ruff.

---

## Python backend (optional)

Only needed if you're working on `backends/fastapi` or the scrapers.

```bash
cd backends/fastapi
cp .env.example .env   # default DATABASE_URL works with the Docker database
uv sync                # creates .venv and installs all dependencies
bun run dev            # = uv run uvicorn app.main:app --reload --port 8000
```

API docs live at <http://localhost:8000/docs>. Lint with `uv run ruff check .`
and format with `uv run ruff format .`.

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

**`bun run dev` doesn't start FastAPI**
Expected unless you've run `uv sync` in `backends/fastapi` and `uv` is on your PATH.

**Wipe the database and start fresh**
`docker compose down -v` (deletes the data volume), then `bun run db:up && bun run db:push`.
