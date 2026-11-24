#!/usr/bin/env bash
# Deploy from the laptop: rsync source, build on the VPS, swap, health-check.
# Usage: pnpm run deploy        (DEPLOY_HOST overrides the ssh alias)
set -euo pipefail

HOST="${DEPLOY_HOST:-nusuk-vps}"
REMOTE_DIR="${REMOTE_DIR:-/srv/nusuk-keys/app}"
cd "$(dirname "$0")/.."

echo "==> rsync to $HOST:$REMOTE_DIR"
rsync -az --delete \
  --filter='P .env' \
  --exclude node_modules --exclude dist --exclude .data --exclude .git \
  --exclude .scratch --exclude .claude --exclude '*.mp4' --exclude demo \
  --exclude reference --exclude .DS_Store \
  ./ "$HOST:$REMOTE_DIR/"

echo "==> build and swap on $HOST"
ssh "$HOST" "REMOTE_DIR='$REMOTE_DIR' bash -s" <<'REMOTE'
set -uo pipefail
cd "$REMOTE_DIR"
export APP_UID="$(id -u)" APP_GID="$(id -g)"
IMG=nusuk-keys-app
NEW="$IMG:build-$(date +%Y%m%d%H%M%S)"

wait_healthy() {
  for _ in $(seq 1 45); do
    s="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' nusuk-app 2>/dev/null || echo missing)"
    [ "$s" = healthy ] && return 0
    sleep 2
  done
  return 1
}

echo "building $NEW"
if ! docker build -t "$NEW" . </dev/null; then
  echo "BUILD FAILED; running stack left untouched." >&2
  exit 1
fi

had_current=0
if docker image inspect "$IMG:current" >/dev/null 2>&1; then
  had_current=1
  docker tag "$IMG:current" "$IMG:previous"
fi
docker tag "$NEW" "$IMG:current"
docker rmi "$NEW" >/dev/null # drop the build tag; :current keeps the image
docker compose up -d --remove-orphans </dev/null

if wait_healthy; then
  docker image prune -f >/dev/null 2>&1 || true
  echo "DEPLOY OK: $NEW is healthy."
  exit 0
fi

echo "NEW VERSION UNHEALTHY; last app logs:" >&2
docker compose logs --tail=30 app >&2 || true
if [ "$had_current" = 1 ]; then
  echo "rolling back to previous image" >&2
  docker tag "$IMG:previous" "$IMG:current"
  docker compose up -d --remove-orphans </dev/null
  if wait_healthy; then echo "ROLLED BACK: previous version is healthy." >&2
  else echo "ROLLBACK ALSO UNHEALTHY: investigate on the server." >&2; fi
else
  echo "no previous image to roll back to." >&2
fi
exit 1
REMOTE
