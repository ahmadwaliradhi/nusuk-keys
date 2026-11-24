# 0001: Self-host on a VPS instead of Cloudflare Workers

Status: accepted (2026-11-24)

## Context

Nusuk Keys ran as a TanStack Start Worker with a D1 database on Cloudflare's free plan. Daily quotas (Worker requests, D1 row writes) were exhausted by normal traffic, which took the whole site down for every visitor until the quota reset. A schema migration could not be applied for the same reason, and the code grew a cron trigger and a schema-fallback path just to work around refused writes.

## Decision

Run the app on a single VPS (Sumopod, Jakarta, 2 vCPU / 2 GB / 40 GB, Ubuntu 24.04):

- Docker Compose with two containers: Caddy (automatic TLS) in front of the app on Node 24.
- SQLite file on a volume (WAL mode) via `better-sqlite3`. Migrations run at container start and are tracked in `_migrations`.
- Cloudflare stays only as DNS for `nusuk-keys.web.id` (DNS-only record) and as an R2 bucket for off-box backups. It is not in the request path.
- Deploys are a script: rsync the source to the VPS and build the image there.
- Nightly `sqlite3 .backup`, 14 days kept locally, copied to R2.

## Alternatives rejected

- **Workers Paid plan**: lifts the quotas for a small monthly fee, but keeps per-request and per-row-write metering as a failure mode. The VPS was already bought.
- **Postgres**: an extra service and a query rewrite for 68k rows on one box. D1 is SQLite, so the schema, queries and export dump carry over unchanged.
- **Cloudflare proxy in front of the VPS**: free shielding, but keeps Cloudflare in the request path. Can be switched on later with no code change other than which header carries the client IP.
- **CI with a registry**: the repo has no remote yet; revisit when it gets one.

## Consequences

- No request or write quota; capacity is the box.
- Availability now depends on one machine. Mitigated by container restart policy, an external uptime check, and off-box backups; there is no failover.
- We own OS patching, firewall, TLS renewal (Caddy) and backups.
- The accidental abuse ceiling the quota provided is gone, so `POST /api/keys` gets its own per-IP rate limit.
- This departs from the usual "TanStack on Cloudflare" default for this author's projects. That default still applies elsewhere.
