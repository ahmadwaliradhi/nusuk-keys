import { env } from "cloudflare:workers";

import migration0002 from "../../migrations/0002_invalid_pinned.sql?raw";
import { KEY_RE, PINNED_KEY, normalizeKey } from "./keys-shared";

export { KEY_RE, PINNED_KEY, normalizeKey };
export const MAX_KEYS_PER_REQUEST = 5000;
export const MAX_LIMIT = 200;
export const MAX_Q = 64;
export const MAX_BODY_BYTES = 256 * 1024;

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface KeyItem {
  no: number;
  k: string;
  invalid: boolean;
  pinned?: true;
}

export const UNDO_WINDOW_S = 120;
export const RATE_WINDOW_S = 600;
export const RATE_MAX = 30;
export const INVALID_LIST_CAP = 2000;

const nowS = () => Math.floor(Date.now() / 1000);

// Migration 0002 adds invalid_at/status_at. Until it runs, fall back to the old schema:
// listing works, invalid marking is unavailable. A positive result is cached for good,
// a negative one is rechecked every 60s so the feature turns on right after migrating.
let schemaCache: { has: boolean; t: number } | null = null;

async function hasInvalidCols(db: D1Database): Promise<boolean> {
  if (schemaCache && (schemaCache.has || Date.now() - schemaCache.t < 60_000))
    return schemaCache.has;
  const r = await db
    .prepare("SELECT COUNT(*) AS c FROM pragma_table_info('keys') WHERE name = 'invalid_at'")
    .first<{ c: number }>();
  schemaCache = { has: (r?.c ?? 0) > 0, t: Date.now() };
  return schemaCache.has;
}

const MIGRATION_0002 = "0002_invalid_pinned.sql";

/**
 * Applies migration 0002 from inside the Worker when its columns are missing (run by the
 * cron trigger). Records it in d1_migrations so `wrangler d1 migrations apply` stays in sync.
 * D1 runs a batch as one transaction, so a failure (e.g. daily write quota) changes nothing.
 */
export async function ensureSchema(): Promise<"ok" | "applied"> {
  const db = env.DB;
  schemaCache = null;
  if (await hasInvalidCols(db)) return "ok";
  const stmts = migration0002
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => db.prepare(x));
  stmts.push(
    db.prepare(
      "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
    ),
    db.prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)").bind(MIGRATION_0002),
  );
  await db.batch(stmts);
  schemaCache = null;
  totalsCache = null;
  return "applied";
}

let totalsCache: { total: number; valid: number; t: number } | null = null;

async function getTotals(db: D1Database) {
  if (totalsCache && Date.now() - totalsCache.t < 15_000) return totalsCache;
  const has = await hasInvalidCols(db);
  const r = await db
    .prepare(
      has
        ? "SELECT COUNT(*) AS t, COALESCE(SUM(invalid_at IS NULL), 0) AS v FROM keys"
        : "SELECT COUNT(*) AS t, COUNT(*) AS v FROM keys",
    )
    .first<{ t: number; v: number }>();
  totalsCache = { total: r?.t ?? 0, valid: r?.v ?? 0, t: Date.now() };
  return totalsCache;
}

export async function listKeys(opts: {
  offset: number;
  after: number;
  limit: number;
  q: string;
  valid: boolean;
}) {
  const db = env.DB;
  const { offset, after, limit, q, valid: onlyValid } = opts;
  const like = q ? `%${escapeLike(q)}%` : null;
  const first = offset === 0 && after === 0;
  const conds = ["k != ?"];
  const bind: unknown[] = [PINNED_KEY];
  if (after > 0) {
    conds.push("no > ?");
    bind.push(after);
  }
  if (like) {
    conds.push("k LIKE ? ESCAPE '\\'");
    bind.push(like);
  }
  const has = await hasInvalidCols(db);
  if (onlyValid && has) conds.push("invalid_at IS NULL");
  const where = conds.join(" AND ");
  const invCol = has ? "invalid_at" : "NULL AS invalid_at";
  const rowsStmt = db
    .prepare(`SELECT no, k, ${invCol} FROM keys WHERE ${where} ORDER BY no LIMIT ? OFFSET ?`)
    .bind(...bind, limit + 1, after > 0 ? 0 : offset);
  const totals = await getTotals(db);
  const pinnedMatches = !q || PINNED_KEY.toLowerCase().includes(q);
  type Row = { no: number; k: string; invalid_at: number | null };
  let filtered: number | null = null;
  let rows: Row[];
  let pinnedNo = 0;
  if (first) {
    const stmts: D1PreparedStatement[] = [rowsStmt];
    const needCount = !!like || (onlyValid && has);
    if (needCount) {
      const cw = conds.filter((c) => !c.startsWith("no >")).join(" AND ");
      const cb = bind.filter((_, i) => !(after > 0 && i === 1));
      stmts.push(db.prepare(`SELECT COUNT(*) AS c FROM keys WHERE ${cw}`).bind(...cb));
    }
    if (pinnedMatches) stmts.push(db.prepare("SELECT no FROM keys WHERE k = ?").bind(PINNED_KEY));
    const res = await db.batch<any>(stmts);
    rows = res[0].results as Row[];
    let i = 1;
    if (needCount) filtered = (res[i++].results[0] as { c: number }).c + (pinnedMatches ? 1 : 0);
    else filtered = totals.total;
    if (pinnedMatches) pinnedNo = (res[i].results[0] as { no: number } | undefined)?.no ?? 0;
  } else {
    rows = (await rowsStmt.all<Row>()).results;
  }
  const hasMore = rows.length > limit;
  const items: KeyItem[] = rows
    .slice(0, limit)
    .map((r) => ({ no: r.no, k: r.k, invalid: r.invalid_at != null }));
  if (first && pinnedMatches)
    items.unshift({ no: pinnedNo, k: PINNED_KEY, invalid: false, pinned: true });
  return {
    items,
    total: totals.total,
    valid: totals.valid,
    filtered,
    hasMore,
    now: nowS(),
  };
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type MarkResult =
  | { ok: true; k: string; invalid: true; invalidAt: number }
  | { ok: false; error: "pinned" | "not found" | "rate" | "unavailable" };

export async function markInvalid(k: string, ip: string): Promise<MarkResult> {
  if (k === PINNED_KEY) return { ok: false, error: "pinned" };
  const db = env.DB;
  if (!(await hasInvalidCols(db))) return { ok: false, error: "unavailable" };
  const row = await db
    .prepare("SELECT invalid_at FROM keys WHERE k = ?")
    .bind(k)
    .first<{ invalid_at: number | null }>();
  if (!row) return { ok: false, error: "not found" };
  if (row.invalid_at != null) return { ok: true, k, invalid: true, invalidAt: row.invalid_at };
  const now = nowS();
  const ipHash = await sha256Hex(ip);
  const c = await db
    .prepare("SELECT COUNT(*) AS c FROM invalid_reports WHERE ip = ? AND at >= ?")
    .bind(ipHash, now - RATE_WINDOW_S)
    .first<{ c: number }>();
  if ((c?.c ?? 0) >= RATE_MAX) return { ok: false, error: "rate" };
  const up = await db
    .prepare("UPDATE keys SET invalid_at = ?1, status_at = ?1 WHERE k = ?2 AND invalid_at IS NULL")
    .bind(now, k)
    .run();
  totalsCache = null;
  if ((up.meta.changes ?? 0) === 0) {
    const again = await db
      .prepare("SELECT invalid_at FROM keys WHERE k = ?")
      .bind(k)
      .first<{ invalid_at: number | null }>();
    return { ok: true, k, invalid: true, invalidAt: again?.invalid_at ?? now };
  }
  await db.batch([
    db.prepare("INSERT INTO invalid_reports (k, ip, at) VALUES (?, ?, ?)").bind(k, ipHash, now),
    db.prepare("DELETE FROM invalid_reports WHERE at < ?").bind(now - 86_400),
  ]);
  return { ok: true, k, invalid: true, invalidAt: now };
}

export type UndoResult =
  | { ok: true; k: string; invalid: false }
  | { ok: false; error: "pinned" | "not found" | "undo window passed" | "unavailable" };

export async function undoInvalid(k: string): Promise<UndoResult> {
  if (k === PINNED_KEY) return { ok: false, error: "pinned" };
  const db = env.DB;
  if (!(await hasInvalidCols(db))) return { ok: false, error: "unavailable" };
  const row = await db
    .prepare("SELECT invalid_at FROM keys WHERE k = ?")
    .bind(k)
    .first<{ invalid_at: number | null }>();
  if (!row) return { ok: false, error: "not found" };
  if (row.invalid_at == null) return { ok: true, k, invalid: false };
  const now = nowS();
  if (row.invalid_at < now - UNDO_WINDOW_S) return { ok: false, error: "undo window passed" };
  const up = await db
    .prepare("UPDATE keys SET invalid_at = NULL, status_at = ?1 WHERE k = ?2 AND invalid_at >= ?3")
    .bind(now, k, now - UNDO_WINDOW_S)
    .run();
  totalsCache = null;
  if ((up.meta.changes ?? 0) === 0) return { ok: false, error: "undo window passed" };
  return { ok: true, k, invalid: false };
}

export async function listInvalidSince(since: number) {
  const db = env.DB;
  const now = nowS();
  if (!(await hasInvalidCols(db))) return { now, invalid: [] as string[], valid: [] as string[] };
  if (since <= 0) {
    const r = await db
      .prepare("SELECT k FROM keys WHERE invalid_at IS NOT NULL ORDER BY status_at LIMIT ?")
      .bind(INVALID_LIST_CAP)
      .all<{ k: string }>();
    return { now, invalid: r.results.map((x) => x.k), valid: [] as string[] };
  }
  const r = await db
    .prepare("SELECT k, invalid_at FROM keys WHERE status_at >= ? ORDER BY status_at LIMIT ?")
    .bind(since, INVALID_LIST_CAP)
    .all<{ k: string; invalid_at: number | null }>();
  const invalid: string[] = [];
  const valid: string[] = [];
  for (const x of r.results) (x.invalid_at != null ? invalid : valid).push(x.k);
  return { now, invalid, valid };
}

export async function addKeys(input: unknown[]) {
  const db = env.DB;
  const valid = new Set<string>();
  let invalid = 0;
  for (const raw of input) {
    const k = normalizeKey(raw);
    if (k) valid.add(k);
    else invalid++;
  }
  const list = [...valid];
  const now = Math.floor(Date.now() / 1000);
  const stmts: D1PreparedStatement[] = [];
  const CH = 90; // D1 allows 100 bound params per statement
  for (let i = 0; i < list.length; i += CH) {
    const part = list.slice(i, i + CH);
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO keys (k, src, created_at) VALUES ${part.map(() => `(?, 'user', ${now})`).join(",")}`,
        )
        .bind(...part),
    );
  }
  let added = 0;
  if (stmts.length) {
    const res = await db.batch(stmts);
    for (const r of res) added += r.meta.changes ?? 0;
  }
  totalsCache = null;
  return { added, skipped: list.length - added, invalid };
}
