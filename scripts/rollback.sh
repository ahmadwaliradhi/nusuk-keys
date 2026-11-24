#!/usr/bin/env bash
# Swap the running app to the previous image (current and previous trade places).
# Usage: pnpm run rollback      (DEPLOY_HOST overrides the ssh alias)
set -euo pipefail

HOST="${DEPLOY_HOST:-nusuk-vps}"
REMOTE_DIR="${REMOTE_DIR:-/srv/nusuk-keys/app}"

ssh "$HOST" "REMOTE_DIR='$REMOTE_DIR' bash -s" <<'REMOTE'
set -uo pipefail
cd "$REMOTE_DIR"
export APP_UID="$(id -u)" APP_GID="$(id -g)"
IMG=nusuk-keys-app

if ! docker image inspect "$IMG:previous" >/dev/null 2>&1; then
  echo "no previous image to roll back to." >&2
  exit 1
fi
if docker image inspect "$IMG:current" >/dev/null 2>&1; then
  docker tag "$IMG:current" "$IMG:swap"
fi
docker tag "$IMG:previous" "$IMG:current"
if docker image inspect "$IMG:swap" >/dev/null 2>&1; then
  docker tag "$IMG:swap" "$IMG:previous"
  docker rmi "$IMG:swap" >/dev/null
fi
docker compose up -d --remove-orphans </dev/null

for _ in $(seq 1 45); do
  s="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' nusuk-app 2>/dev/null || echo missing)"
  if [ "$s" = healthy ]; then echo "ROLLBACK OK: app is healthy."; exit 0; fi
  sleep 2
done
echo "ROLLBACK DONE BUT APP UNHEALTHY; check logs." >&2
docker compose logs --tail=30 app >&2 || true
exit 1
REMOTE
