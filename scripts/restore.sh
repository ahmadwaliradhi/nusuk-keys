#!/usr/bin/env bash
# Restore or verify a backup.
#   restore.sh verify <backup.db.gz|latest> [scratch.db]   integrity + row count, touches nothing live
#   restore.sh apply  <backup.db.gz|latest>                stop app, swap DB in, start app
# Env: DB_PATH, BACKUP_DIR, COMPOSE_DIR (default /srv/nusuk-keys/app), SKIP_DOCKER=1 to skip stop/start.
set -euo pipefail

DB_PATH="${DB_PATH:-/srv/nusuk-keys/data/nusuk-keys.db}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nusuk-keys/backups}"
COMPOSE_DIR="${COMPOSE_DIR:-/srv/nusuk-keys/app}"
SKIP_DOCKER="${SKIP_DOCKER:-0}"

usage() { sed -n '2,6p' "$0"; exit 2; }
mode="${1:-}"; src="${2:-}"
[ -n "$mode" ] && [ -n "$src" ] || usage

if [ "$src" = "latest" ]; then
  src="$(ls -1 "$BACKUP_DIR"/nusuk-keys-*.db.gz 2>/dev/null | sort | tail -n1 || true)"
  [ -n "$src" ] || { echo "no backups in $BACKUP_DIR" >&2; exit 1; }
fi
[ -f "$src" ] || { echo "not found: $src" >&2; exit 1; }

check_db() {
  local f="$1" res
  res="$(sqlite3 "$f" 'PRAGMA integrity_check;')"
  [ "$res" = "ok" ] || { echo "integrity_check FAILED: $res" >&2; return 1; }
  echo "integrity_check: ok"
  echo "keys: $(sqlite3 "$f" 'SELECT COUNT(*) FROM keys;')"
}

case "$mode" in
  verify)
    scratch="${3:-$(mktemp -u "${TMPDIR:-/tmp}/nusuk-verify.XXXXXX.db")}"
    gunzip -c "$src" > "$scratch"
    echo "verifying $src -> $scratch"
    check_db "$scratch"
    ;;
  apply)
    new="$DB_PATH.restore.$$"
    trap 'rm -f "$new" "$new-wal" "$new-shm"' EXIT
    gunzip -c "$src" > "$new"
    check_db "$new"   # refuse to touch live data if the backup is bad
    rm -f "$new-wal" "$new-shm"
    # Match the live file's owner so the container user can still write it.
    if [ "$(id -u)" = 0 ] && [ -f "$DB_PATH" ]; then chown --reference="$DB_PATH" "$new"; fi
    if [ "$SKIP_DOCKER" != 1 ]; then
      (cd "$COMPOSE_DIR" && docker compose stop app)
      # Whatever happens next, bring the app back up.
      trap 'rm -f "$new" "$new-wal" "$new-shm"; (cd "$COMPOSE_DIR" && docker compose start app) || true' EXIT
    fi
    if [ -f "$DB_PATH" ]; then
      aside="$DB_PATH.before-restore-$(date +%Y%m%d-%H%M%S)"
      cp -p "$DB_PATH" "$aside"
      echo "current DB saved as $aside"
    fi
    rm -f "$DB_PATH-wal" "$DB_PATH-shm"
    mv "$new" "$DB_PATH"
    trap - EXIT
    [ "$SKIP_DOCKER" = 1 ] || (cd "$COMPOSE_DIR" && docker compose start app)
    echo "restored $src -> $DB_PATH"
    ;;
  *) usage ;;
esac
