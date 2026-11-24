#!/usr/bin/env bash
# Nightly snapshot of the SQLite DB. Runs on the VPS as `deploy` (systemd timer).
# Env: DB_PATH, BACKUP_DIR, KEEP_DAYS, RCLONE_REMOTE (default r2:), R2_BUCKET.
set -euo pipefail

DB_PATH="${DB_PATH:-/srv/nusuk-keys/data/nusuk-keys.db}"
BACKUP_DIR="${BACKUP_DIR:-/srv/nusuk-keys/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2:}"
R2_BUCKET="${R2_BUCKET:-nusuk-keys-backups}"

log() { echo "[backup $(date -u +%FT%TZ)] $*"; }

[ -f "$DB_PATH" ] || { log "ERROR: database not found: $DB_PATH"; exit 1; }
mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
tmp="$(mktemp "$BACKUP_DIR/.snapshot.XXXXXX")"
trap 'rm -f "$tmp" "$tmp.gz"' EXIT
rm -f "$tmp"   # sqlite3 .backup wants to create the file itself

sqlite3 "$DB_PATH" ".timeout 10000" ".backup '$tmp'"
check="$(sqlite3 "$tmp" 'PRAGMA integrity_check;')"
[ "$check" = "ok" ] || { log "ERROR: snapshot failed integrity_check: $check"; exit 1; }

out="$BACKUP_DIR/nusuk-keys-$stamp.db.gz"
trap 'rm -f "$tmp" "$tmp.gz" "$out.part"' EXIT
gzip -c "$tmp" > "$out.part"
mv "$out.part" "$out"
log "snapshot written: $out ($(du -h "$out" | cut -f1))"

find "$BACKUP_DIR" -maxdepth 1 -name 'nusuk-keys-*.db.gz' -type f -mtime +"$KEEP_DAYS" -print -delete \
  | sed 's/^/[backup] pruned /' || true

if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -qxF "$RCLONE_REMOTE"; then
  # --s3-no-head: after a PUT, rclone 1.60 (Ubuntu 24.04) re-reads the object with
  # HEAD ?versionId=..., which R2 answers 501. The PUT carries Content-MD5, so R2
  # still verifies the upload.
  rclone copy "$out" "${RCLONE_REMOTE}${R2_BUCKET}/" --s3-no-check-bucket --s3-no-head
  log "uploaded to ${RCLONE_REMOTE}${R2_BUCKET}/"
else
  log "WARNING: R2 remote '${RCLONE_REMOTE}' not configured; skipped upload. Local snapshot kept. Run 'rclone config' as deploy."
fi
