# Nusuk Keys

TanStack Start (React) on Cloudflare Workers, D1 storage, Tailwind v4 + shadcn/ui. Lint/format with oxlint + oxfmt.

## Local development

```sh
pnpm install
pnpm gen-seed            # data/keys.json -> seed/keys-XX.sql (already generated)
pnpm db:migrate:local
pnpm db:seed:local       # 68,037 keys
pnpm dev
```

Routes: `/` (keys), `/answers` (answer key; `/soal` and `/soal.php` redirect here).
API: `GET /api/keys?limit&q&after|offset&valid=1` (items `{no,k,invalid,pinned?}`, plus `total,valid,filtered,hasMore,now`), `POST /api/keys {keys:[...]}`, `POST /api/keys/invalid {k,undo?}` (mark invalid; undo within 2 min; 30 marks/10 min/IP), `GET /api/keys/invalid?since=<unix>` (`{now,invalid[],valid[]}`), `GET /api/answers?offset&limit&q`.

## Deploy (workers.dev)

1. `wrangler d1 create nusuk-keys` and put the returned id in `wrangler.jsonc` (`database_id`).
2. `pnpm db:migrate:remote`
3. `pnpm db:seed:remote` (runs every `seed/keys-*.sql`; safe to re-run, `INSERT OR IGNORE`)
4. `pnpm deploy`

For a custom domain later, add `"routes": [{ "pattern": "nusuk-keys.<zone>", "custom_domain": true }]` to `wrangler.jsonc`.

## Scripts

`dev`, `build`, `deploy`, `lint`, `format`, `typecheck`, `db:migrate:local|remote`, `db:seed:local|remote`.
