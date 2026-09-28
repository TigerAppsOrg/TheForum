#!/bin/bash
# Assemble a self-contained release tarball from a completed `next build` (output: standalone).
#   deploy/build-release.sh <out.tar.gz>
# Layout inside the tarball:
#   web/            Next standalone server (web/apps/web/server.js) with static assets
#   tools/          migrate.js and sync.js, bundled for Bun (no node_modules needed)
#   drizzle/        SQL migrations
#   deploy/         host scripts, systemd units and nginx sites
set -euo pipefail
out=${1:?output path required}
root=$(cd "$(dirname "$0")/.." && pwd)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

standalone="$root/apps/web/.next/standalone"
[ -f "$standalone/apps/web/server.js" ] || { echo "Run the web build first (missing $standalone/apps/web/server.js)"; exit 1; }
mkdir -p "$stage/web" "$stage/tools"
cp -R "$standalone/." "$stage/web/"
mkdir -p "$stage/web/apps/web/.next"
cp -R "$root/apps/web/.next/static" "$stage/web/apps/web/.next/static"
[ -d "$root/apps/web/public" ] && cp -R "$root/apps/web/public" "$stage/web/apps/web/public"

bun build "$root/apps/database/src/migrate.ts" --target=bun --outfile "$stage/tools/migrate.js" >/dev/null
bun build "$root/apps/database/src/sync-inbox-engine.ts" --target=bun --outfile "$stage/tools/sync.js" >/dev/null
cp -R "$root/apps/database/drizzle" "$stage/drizzle"
cp -R "$root/deploy" "$stage/deploy"
git -C "$root" rev-parse HEAD > "$stage/REVISION"

tar -czf "$out" -C "$stage" .
echo "Release written to $out ($(du -h "$out" | cut -f1))"
