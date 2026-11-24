# Move Nusuk Keys from Cloudflare Workers to a VPS

Status: ready-for-agent

Decision record: `docs/adr/0001-vps-over-cloudflare-workers.md`. Read it first.

## Problem Statement

Nusuk Keys runs as a Cloudflare Worker with a D1 database on the free plan. The daily quota has been reached, so nobody can open the webapp until it resets, and this will keep happening. A schema migration (invalid marks) could not be applied for the same reason, and the code carries a cron trigger and a schema-fallback path only to work around refused writes. The owner has bought a VPS and wants the app served from it instead.

## Solution

Serve the same app, at the same domain (`nusuk-keys.web.id`), with the same pages and API, from one VPS the owner controls. Visitors notice nothing except that the site is up. Existing data (seed keys, user-added keys, invalid marks) is carried over. The owner deploys with one command, gets nightly backups stored off the box, and is alerted when the site is down. No credential is ever pasted into an agent chat or committed to the repo.

## User Stories

Visitor

1. As a visitor, I want the site to load at `nusuk-keys.web.id` regardless of how many people used it today, so that I can get a key when I need one.
2. As a visitor, I want the key list, search, "valid only" filter and paging to behave exactly as before, so that nothing I learned changes.
3. As a visitor, I want the pinned key to still appear first, so that the list order is unchanged.
4. As a visitor, I want keys other people added before the move to still be there, so that nothing was lost.
5. As a visitor, I want invalid marks made before the move to still be shown, so that I do not retry dead keys.
6. As a visitor, I want to mark a key invalid and undo it within two minutes, so that mistakes are reversible.
7. As a visitor, I want marking invalid to always be available, so that I never see the "unavailable" error that existed while the migration was blocked.
8. As a visitor, I want to add keys by paste or CSV as before, so that I can contribute.
9. As a visitor, I want the answers page and the `/soal` and `/soal.php` redirects to work, so that old links keep working.
10. As a visitor, I want the site served over HTTPS with a valid certificate that renews itself, so that my browser never warns me.
11. As a visitor on a slow connection, I want responses compressed and static assets cached, so that pages load quickly.
12. As a visitor behind a shared network, I want rate limits counted per real client IP, so that I am not blocked by a stranger's activity elsewhere.
13. As a visitor, I want a clear "too many requests" response when I hit a limit, so that I know to wait.

Owner

14. As the owner, I want no request or write quota, so that traffic cannot take the site down by itself.
15. As the owner, I want to deploy with a single command from my laptop, so that shipping a change takes a minute.
16. As the owner, I want a failed build to leave the running version untouched, so that a bad deploy does not cause downtime.
17. As the owner, I want to roll back to the previous version with one command, so that I can recover fast.
18. As the owner, I want schema migrations applied automatically when the app starts, so that I never run them by hand.
19. As the owner, I want the app to refuse to start when a migration fails, so that it never serves on a half-migrated database.
20. As the owner, I want the database to survive container rebuilds and reboots, so that deploys never lose data.
21. As the owner, I want a nightly consistent database snapshot, kept for 14 days on the VPS, so that I can undo data damage.
22. As the owner, I want each snapshot copied to storage outside the VPS, so that losing the machine does not lose the data.
23. As the owner, I want a documented, tested restore procedure, so that a backup is known to be usable.
24. As the owner, I want the app to restart by itself after a crash or reboot, so that short failures heal without me.
25. As the owner, I want an external check every five minutes that alerts me, so that I hear about downtime before visitors tell me.
26. As the owner, I want bulk key submission rate-limited per IP, so that one script cannot pollute the key list or fill the disk.
27. As the owner, I want the server reachable only over SSH with my key, with root and password login disabled, so that it is not an easy target.
28. As the owner, I want only SSH, HTTP and HTTPS ports open, so that the app and database are not exposed directly.
29. As the owner, I want security updates applied automatically, so that the box does not rot.
30. As the owner, I want every credential entered by me directly on my laptop or the VPS, so that none appears in chat logs or git.
31. As the owner, I want the server setup captured as a re-runnable script, so that I can rebuild the box from scratch.
32. As the owner, I want the old Worker and D1 database left in place for a week after cutover, so that I have a fallback.
33. As the owner, I want a cutover checklist with a verification step before DNS changes, so that I only switch once the VPS is proven.
34. As the owner, I want logs I can read with one command and that rotate, so that I can debug without filling the disk.

Developer

35. As a developer, I want `pnpm dev` to run against a local SQLite file with the same migrations and seed, so that local equals production.
36. As a developer, I want no Cloudflare tooling needed to build or run, so that setup is `pnpm install`.
37. As a developer, I want the README to describe the new local, deploy, backup and restore flows, so that I do not have to read scripts.
38. As a developer, I want lint, format and typecheck to keep passing, so that the migration does not lower the bar.

## Implementation Decisions

Environment (facts)

- VPS: Sumopod, Jakarta, 2 vCPU, 2 GB RAM, 40 GB SSD, Ubuntu 24.04, name `vps-wali-jakarta-1`. Dedicated to this app.
- The agent reaches it only as `ssh nusuk-vps` (alias in the owner's SSH config, key auth). If that alias does not work, stop and ask the owner; never ask for the password or IP in chat.
- The repo has no git remote. Laptop is arm64; the VPS is assumed amd64, so images are built on the VPS.

Runtime and build

- TanStack Start is built for a plain Node server; the Cloudflare Vite plugin, wrangler, the Workers types, the wrangler config, the D1 scripts and the Workers type declarations are removed.
- Node 24 LTS. The server must serve the built client assets and the SSR/API handler, listen on a configurable port, and expose a cheap health endpoint or reuse `GET /api/keys?limit=1`.
- Not verified yet: the exact Node build path for the installed TanStack Start version (1.169). `srvx` is already present as a transitive dependency; Nitro is not installed. The implementer picks whichever the installed version's docs support and confirms it by building and running locally before anything else.
- The scheduled handler is deleted; nothing replaces it.

Database module

- Storage is one SQLite file accessed through `better-sqlite3`, opened once per process with WAL mode, a busy timeout, and foreign keys on. Path comes from an environment variable, defaulting to a file under the data directory for local dev.
- The key store's public interface (list keys, add keys, mark invalid, undo invalid, list invalid since, plus its exported limits and constants) keeps its current names, arguments and result shapes so the API routes change as little as possible. Functions may stay async.
- Batches that relied on D1's implicit transaction become explicit transactions.
- The schema-detection fallback, the in-Worker migration applier and the `unavailable` result are removed; the two existing HTTP 503 mappings for it go too.
- The 90-keys-per-statement chunking existed for D1's bound-parameter limit; it may be simplified to a prepared insert run inside one transaction.
- The totals cache (15 s) stays.

Migrations and seed

- At process start, before listening, apply every file in the migrations directory in name order that is not yet recorded in a `_migrations` table (name, applied time), each in its own transaction. Any failure exits non-zero.
- Importing a D1 export brings a `d1_migrations` table. On first start, if `d1_migrations` exists and `_migrations` is empty, copy its names across so already-applied migrations are not re-run (migration 0002 uses `ALTER TABLE ADD COLUMN`, which is not re-runnable). Whether 0002 was ever applied on the remote D1 is unknown; this rule handles both cases.
- A seed command loads the existing seed SQL files into the local database for development and is the fallback data source for production if the D1 export is unavailable.

Client IP and rate limits

- The app is only reachable through Caddy on the Compose network; its port is not published on the host. Client IP is the address Caddy supplies in `X-Forwarded-For` (Caddy must overwrite, not append, any client-supplied value). The `cf-connecting-ip` read is replaced by one shared helper so a later switch to the Cloudflare proxy is a one-line change.
- Invalid-mark limit unchanged: 30 marks per 10 minutes per IP, IP stored hashed.
- New: `POST /api/keys` is limited to 10 requests per 10 minutes per IP, answered with HTTP 429 and the same error envelope (`status: "error"`, `error: "rate"`). In-memory counting is acceptable (single process); it resets on restart.
- The UI must show a sensible message for the new 429 on add keys, in the existing i18n languages, mirroring how the invalid-mark rate error is shown.

API contract

- Unchanged for all routes and response shapes documented in the README, except: the `unavailable` error disappears, and `POST /api/keys` can now return 429.

Containers

- Docker Compose with two services: `app` (multi-stage image, non-root user, production dependencies only, native module compiled in the build stage) and `caddy`.
- Caddy: site `nusuk-keys.web.id`, automatic Let's Encrypt, reverse proxy to `app`, compression, long cache headers for hashed assets, ports 80 and 443 (TCP) and 443 (UDP). Certificates and config state on a named volume.
- Database on a host-mounted directory (not inside the image) so backups can read it from the host.
- Both services `restart: unless-stopped`, log rotation configured, healthcheck on `app`.

Server setup

- One idempotent setup script, run over SSH: create `deploy` user with the owner's public key and Docker access; install Docker Engine and the Compose plugin, sqlite3, rclone, ufw, fail2ban, unattended-upgrades; disable root and password SSH login; ufw default deny with 22, 80, 443/tcp and 443/udp allowed; 1 GB swap file; app directory layout.
- Disabling password login is done only after confirming key login works for `deploy`, so the owner cannot be locked out. After setup the alias should log in as `deploy`.

Deploy

- `pnpm deploy`: rsync the source (excluding dependencies, build output, local data, git and scratch directories) to the VPS, build there, tag the currently running image as previous, bring the stack up, wait for the healthcheck, print the result. A failed build or healthcheck leaves or restores the previous image.
- A rollback command switches back to the previous image.

Backups

- A host cron job (or systemd timer) runs nightly: `sqlite3 .backup` to a dated file, compress, delete local files older than 14 days, then rclone copy to an R2 bucket.
- The R2 credentials live only in rclone's config on the VPS, readable by one user. The owner creates the bucket and token and types them on the VPS; the spec's scripts must work with the remote unconfigured by skipping the upload with a loud log line, not by failing the local snapshot.
- Restore procedure documented and exercised once against a scratch copy.

Monitoring

- Docker healthcheck on `app`. External: the owner creates an UptimeRobot monitor on `https://nusuk-keys.web.id/api/keys?limit=1` at five-minute intervals. The agent documents this; it does not create the account.

Cutover (each step stops for the owner where marked)

1. Local: build and tests pass.
2. Run server setup; deploy to the VPS.
3. Export the remote D1 database with the owner's existing wrangler session (run before wrangler is removed from the working tree, or via `pnpm dlx`). Import into the VPS database. If export is blocked by quota, load the seed files instead and record that user-added keys and invalid marks must be re-imported once the quota resets.
4. Verify on the VPS before DNS: row count matches the export, pinned key first, invalid marks present, every API route answers. Test with a hosts-style override (`curl --resolve`) since the domain still points at Cloudflare. Caddy cannot obtain its certificate until DNS points at the VPS; expect that and verify plain HTTP or the app port internally until then.
5. Owner approval required: change the `nusuk-keys.web.id` record to a DNS-only A record for the VPS and remove the Worker's custom-domain route. The Worker custom domain must be released first, since it owns the record.
6. Confirm certificate issuance and the full flow on the real domain.
7. Worker and D1 database stay for one week. Deleting them is a separate step that needs the owner's explicit approval.

Documentation

- README rewritten for the new local dev, deploy, rollback, backup, restore and cutover flows. No GLOSSARY change: the domain language (key, pinned key, invalid mark, answers) is untouched.

## Testing Decisions

- A good test here exercises external behaviour only: HTTP requests in, HTTP responses out, against a real SQLite file. It does not assert on SQL text, caches or module internals.
- One seam: the HTTP API of the running server. The repo has no test runner and no existing tests, so there is no prior art; add a small smoke suite using Node's built-in test runner (no new framework) that starts the built server on a temporary database and port.
- Cases: list keys (paging by `after` and `offset`, search, `valid=1`, pinned key first and counted); add keys (added, skipped duplicates, rejected malformed, body-size and count limits); mark invalid then undo; undo after the window fails; pinned key cannot be marked; invalid-mark rate limit trips at 31; add-keys rate limit trips at 11 and is per IP via `X-Forwarded-For`; `listInvalidSince` deltas; answers route; fresh database gets all migrations; a database carrying `d1_migrations` with 0001 only gets 0002; one with both gets nothing and starts cleanly.
- The same smoke suite, pointed at a base URL, is the verification step during cutover (read-only cases only against production).
- Infrastructure (setup script, Compose, Caddy, backup) is verified by running it: `docker compose config`, a deploy, a healthcheck, one backup run and one restore into a scratch file. Not unit tested.

## Out of Scope

- Any UI or feature change beyond the new rate-limit message.
- Cloudflare proxy in front of the VPS, a CDN, or moving DNS to another provider.
- CI, a container registry, or creating a git remote.
- Multiple servers, failover, or zero-downtime deploys (a few seconds of restart is accepted).
- Postgres or any other database.
- Deleting the Worker and D1 database (separate, owner-approved step after one week).
- Creating the UptimeRobot account, the R2 bucket or its token (owner does these).

## Further Notes

- Credential rule for whoever implements this: the owner holds the VPS public IP, username and password. They install their key with `ssh-copy-id`, add the `nusuk-vps` alias to their SSH config, and type the R2 token on the VPS themselves. Never request, echo or store these in chat, the repo or issue files.
- The owner's machine cannot resolve `workers.dev` hostnames (local DNS interference); use the custom domain or wrangler's API-based commands when touching the old deployment.
- 2 GB RAM plus 1 GB swap should be enough to build on the box; if the build is killed for memory, raise swap before reaching for a registry.
- The owner's standing preference is TanStack on Cloudflare with oxlint/oxfmt and shadcn/ui. Only the hosting choice changes here; keep the rest.
