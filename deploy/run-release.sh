#!/bin/bash
# Executed as root by the TheForumDeploy SSM document on the-forum-web.
#   run-release.sh <staging|production> <sha>
# Layout: /opt/theforum/<env>/{releases/<sha>,current,shared/environment}
set -euo pipefail
env_name=${1:?environment required}
release=${2:?commit SHA required}
case "$env_name" in
  staging) port=3100; host=forumdev.tigerapps.org ;;
  production) port=3200; host=forum.tigerapps.org ;;
  *) echo "Unknown environment: $env_name"; exit 2 ;;
esac
[[ "$release" =~ ^[a-f0-9]{40}$ ]] || exit 2
root=/opt/theforum/$env_name
dir="$root/releases/$release"
exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
export AWS_DEFAULT_REGION=us-east-1
bun=$(command -v bun || echo /usr/local/bin/bun)
node=$(command -v node || echo /usr/bin/node)

id -u theforum >/dev/null 2>&1 || useradd --system --home /opt/theforum --shell /usr/sbin/nologin theforum
mkdir -p "$root/shared"
umask 077
aws ssm get-parameter --name "/theforum/$env_name/environment" --with-decryption \
  --query Parameter.Value --output text > "$root/shared/environment.next"
[ -s "$root/shared/environment.next" ] || { echo 'Environment parameter is empty'; exit 1; }
mv -f "$root/shared/environment.next" "$root/shared/environment"
chown root:theforum "$root/shared/environment"; chmod 0640 "$root/shared/environment"
umask 022
chown -R root:root "$dir"
# Next's runtime cache is the only path the server writes.
mkdir -p "$dir/web/apps/web/.next/cache" && chown -R theforum:theforum "$dir/web/apps/web/.next/cache"

# Additive migrations before traffic moves.
MIGRATIONS_DIR="$dir/drizzle" "$bun" --env-file="$root/shared/environment" "$dir/tools/migrate.js"

previous=$(readlink -f "$root/current" || true)
ln -sfn "$dir" "$root/current.next" && mv -Tf "$root/current.next" "$root/current"
render() { sed -e "s#@ENV@#$env_name#g" -e "s#@PORT@#$port#g" -e "s#@BUN@#$bun#g" -e "s#@NODE@#$node#g" "$1"; }
render "$dir/deploy/systemd/theforum.service" > "/etc/systemd/system/theforum-$env_name.service"
render "$dir/deploy/systemd/theforum-sync.service" > "/etc/systemd/system/theforum-$env_name-sync.service"
render "$dir/deploy/systemd/theforum-sync.timer" > "/etc/systemd/system/theforum-$env_name-sync.timer"
systemctl daemon-reload
systemctl enable "theforum-$env_name.service" >/dev/null
systemctl restart "theforum-$env_name.service"

healthy=false
for _ in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" || true)
  if [ "$code" = 200 ]; then healthy=true; break; fi
  sleep 2
done
if [ "$healthy" != true ]; then
  echo "Health check failed on :$port; rolling back."
  journalctl -u "theforum-$env_name.service" -n 40 --no-pager || true
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    ln -sfn "$previous" "$root/current.next" && mv -Tf "$root/current.next" "$root/current"
    systemctl restart "theforum-$env_name.service"
  fi
  exit 1
fi
# Signed-out visitors must be sent to the landing page, never shown app pages.
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/explore")
[ "$code" = 307 ] || [ "$code" = 302 ] || { echo "Expected a redirect from /explore when signed out, got $code"; exit 1; }

# Pull organizations, venues and events from InboxEngine now, then every five minutes.
systemctl enable --now "theforum-$env_name-sync.timer" >/dev/null
systemctl start "theforum-$env_name-sync.service" || echo 'Initial InboxEngine sync failed; the timer will retry.'

install -m 0644 "$dir/deploy/nginx/$env_name.conf" "/etc/nginx/sites-available/theforum-$env_name"
ln -sfn "/etc/nginx/sites-available/theforum-$env_name" "/etc/nginx/sites-enabled/theforum-$env_name"
nginx -t && systemctl reload nginx
printf '%s\n' "$release" > "$root/shared/deployed-sha"
ls -1dt "$root"/releases/*/ | tail -n +6 | xargs -r rm -rf --
echo "The Forum ($env_name) $release deployed on :$port for $host."
