# Nusuk Keys

TanStack Start (React) on Node 24, SQLite (`better-sqlite3`), Tailwind v4 + shadcn/ui. Served from one VPS (Docker Compose: Caddy + app) at `nusuk-keys.web.id`. Lint/format with oxlint + oxfmt. Decision record: `docs/adr/0001-vps-over-cloudflare-workers.md`.

Routes: `/` (keys), `/answers` (answer key; `/soal` and `/soal.php` redirect here).

## API

- `GET /api/keys?limit&q&after|offset&valid=1` returns items `{no,k,invalid,pinned?}`, plus `total,valid,filtered,hasMore,now`.
- `POST /api/keys {keys:[...]}` adds keys. Limit: 10 requests / 10 min / IP. Over the limit: HTTP 429 `{status:"error",error:"rate"}`.
- `POST /api/keys/invalid {k,undo?}` marks a key invalid; undo within 2 min. Limit: 30 marks / 10 min / IP (429 `{status:"error",error:"rate"}`).
- `GET /api/keys/invalid?since=<unix>` returns `{now,invalid[],valid[]}`.
- `GET /api/answers?offset&limit&q`.

Client IP is the first value of `X-Forwarded-For`; Caddy overwrites it with the real address.

## Local dev

```sh
pnpm install
pnpm db:seed          # loads seed/keys-*.sql into ./.data/nusuk-keys.db (68,037 keys)
pnpm dev
pnpm build && pnpm start   # production build on :3000
pnpm test
```

Other scripts: `lint`, `format`, `typecheck`, `gen-seed`. Env for `start`: `PORT` (3000), `HOST` (0.0.0.0), `DB_PATH` (`./.data/nusuk-keys.db`), `MIGRATIONS_DIR` (`./migrations`). Migrations apply at startup and the process exits non-zero if one fails.

## Server setup

One-time, on a fresh Ubuntu 24.04 VPS reached as `ssh nusuk-vps` (alias in your SSH config; never put the IP or password in the repo or chat). The script is idempotent. It creates the `deploy` user (with your authorized key and docker access), installs Docker, sqlite3, rclone, ufw, fail2ban and unattended-upgrades, opens only 22/80/443, adds 1 GB swap, creates `/srv/nusuk-keys/{app,data,backups}` and installs the nightly backup timer.

```sh
tar czf - scripts/setup-server.sh scripts/backup.sh deploy \
  | ssh nusuk-vps 'rm -rf /tmp/nusuk-setup && mkdir /tmp/nusuk-setup && tar xzf - -C /tmp/nusuk-setup && sudo bash /tmp/nusuk-setup/scripts/setup-server.sh'
```

Then:

1. Change the `nusuk-vps` alias to `User deploy` and confirm `ssh nusuk-vps docker ps` works.
2. Lock SSH (disables root and password login; do this only after step 1 works), keeping the current session open:
   `tar czf - ... | ssh <login> '... sudo LOCK_SSH=1 bash /tmp/nusuk-setup/scripts/setup-server.sh'` (same command as above with `LOCK_SSH=1`). Test a fresh `ssh nusuk-vps` afterwards.

## Deploy

```sh
pnpm run deploy
```

(`pnpm deploy` without `run` is pnpm's built-in, not this.) It rsyncs the source to `/srv/nusuk-keys/app`, builds the image on the VPS, tags the running image `:previous`, brings the stack up and waits up to ~90 s for the app healthcheck. A failed build leaves the running stack untouched; an unhealthy new version is rolled back automatically and the command exits non-zero. `DEPLOY_HOST` overrides the ssh alias.

## Rollback

```sh
pnpm run rollback
```

Swaps `:current` and `:previous` and restarts; running it again returns to the newer version.

Rollback swaps the image only. Migrations are forward-only, so rolling back across a release that added a migration runs the old code on the new schema; restore a backup (below) if that breaks.

## Logs

```sh
ssh nusuk-vps 'cd /srv/nusuk-keys/app && docker compose logs -f --tail=200 app'
```

Same with `caddy` for the proxy. Logs rotate (10 MB x 5 per container).

## Backups

A systemd timer (`nusuk-backup.timer`, daily 02:30 Asia/Jakarta) runs `scripts/backup.sh` as `deploy`: `sqlite3 .backup`, integrity check, gzip to `/srv/nusuk-keys/backups/nusuk-keys-YYYYMMDD-HHMMSS.db.gz`, delete local files older than 14 days, then `rclone copy` to Cloudflare R2.

Off-box upload needs a remote named `r2` in rclone. Create the R2 bucket `nusuk-keys-backups` and an access token in the Cloudflare dashboard, then type them yourself on the VPS:

```sh
ssh nusuk-vps
rclone config                      # new remote "r2", type s3, provider Cloudflare, endpoint https://<account>.r2.cloudflarestorage.com
chmod 600 ~/.config/rclone/rclone.conf
```

Until the remote exists the job logs `R2 remote 'r2:' not configured; skipped upload` and still succeeds. Overrides (in `/srv/nusuk-keys/backup.env`): `RCLONE_REMOTE`, `R2_BUCKET`, `KEEP_DAYS`. Run now: `ssh nusuk-vps sudo systemctl start nusuk-backup.service`; check: `ssh nusuk-vps journalctl -u nusuk-backup -n 20`.

## Restore

Verify a backup without touching live data (integrity check and key count into a scratch file):

```sh
ssh nusuk-vps '/srv/nusuk-keys/app/scripts/restore.sh verify latest /tmp/scratch.db'
```

Restore for real (stops the app, saves the current DB as `*.before-restore-*`, swaps the backup in, starts the app). Pass `latest` or a path; to pull from R2 first: `rclone copy r2:nusuk-keys-backups/<file> /srv/nusuk-keys/backups/`.

```sh
ssh nusuk-vps '/srv/nusuk-keys/app/scripts/restore.sh apply /srv/nusuk-keys/backups/nusuk-keys-YYYYMMDD-HHMMSS.db.gz'
```

## Monitoring

Docker healthcheck on `app` plus `restart: unless-stopped`. External: create an UptimeRobot monitor (HTTP, 5 minute interval) on `https://nusuk-keys.web.id/api/keys?limit=1` and add your alert contact.

## Cutover checklist

Stop at each OWNER step and wait for approval.

1. Local: `pnpm install && pnpm build && pnpm test` pass.
2. Run server setup, then `pnpm run deploy`. Before DNS points here, put `SITE_ADDRESS=http://nusuk-keys.web.id` in `/srv/nusuk-keys/app/.env` on the VPS (plain HTTP, no certificate attempt; the deploy rsync keeps this file) and `docker compose up -d`.
3. Export the live D1 with your existing wrangler session (before wrangler leaves the tree, or via dlx):
   `pnpm dlx wrangler d1 export nusuk-keys --remote --output=d1-export.sql`
   Import into a stopped app's database (the app bridges `d1_migrations` into `_migrations` on first start by itself):
   ```sh
   scp d1-export.sql nusuk-vps:/tmp/
   ssh nusuk-vps 'cd /srv/nusuk-keys/app && docker compose stop app && rm -f /srv/nusuk-keys/data/nusuk-keys.db* && sqlite3 /srv/nusuk-keys/data/nusuk-keys.db < /tmp/d1-export.sql && docker compose start app'
   ```
   If the export is blocked by quota, run `docker compose run --rm app node scripts/seed.mjs` instead and re-import user-added keys and invalid marks once the quota resets.
4. Verify before DNS: row count equals the export, pinned key first, invalid marks present, every route answers:
   `curl --resolve nusuk-keys.web.id:80:<VPS_IP> 'http://nusuk-keys.web.id/api/keys?limit=1'` (use your VPS IP locally; do not write it into the repo).
   Then run the read-only smoke suite against it: add a temporary `<VPS_IP> nusuk-keys.web.id` line to your laptop's `/etc/hosts`, run `BASE_URL=http://nusuk-keys.web.id node --test test/*.test.mjs` (write cases skip themselves when `BASE_URL` is set), and remove the line again.
5. OWNER: release the Worker custom domain (it owns the DNS record), then set `nusuk-keys.web.id` to a DNS-only A record for the VPS. Remove `SITE_ADDRESS` from `.env` and `docker compose up -d` so Caddy fetches the certificate.
6. Confirm the certificate and the full flow on `https://nusuk-keys.web.id`; create the UptimeRobot monitor.
7. Leave the Worker and D1 database for one week. Deleting them is a separate step that needs the owner's explicit approval.

## Credentials rule

The VPS is reached only as `ssh nusuk-vps`. The IP, password, SSH keys and the R2 token are typed by the owner on their laptop or the VPS. Never put them in chat, commits, issue files or this repo.
