import { createHash } from "node:crypto";

import { getDb } from "./db";
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
/** POST /api/keys: requests per IP per RATE_WINDOW_S. */
export const ADD_RATE_MAX = 10;

const nowS = () => Math.floor(Date.now() / 1000);

let totalsCache: { total: number; valid: number; t: number } | null = null;

function getTotals() {
  if (totalsCache && Date.now() - totalsCache.t < 15_000) return totalsCache;
  const r = getDb()
    .prepare("SELECT COUNT(*) AS t, COALESCE(SUM(invalid_at IS NULL), 0) AS v FROM keys")
    .get() as { t: number; v: number };
  totalsCache = { total: r.t, valid: r.v, t: Date.now() };
  return totalsCache;
}

export async function listKeys(opts: {
  offset: number;
  after: number;
  limit: number;
  q: string;
  valid: boolean;
}) {
  const db = getDb();
  const { offset, after, limit, q, valid: onlyValid } = opts;
  const like = q ? `%${escapeLike(q)}%` : null;
  const first = offset === 0 && after === 0;
  // Conditions shared by the page query and the filtered count (paging cursor excluded).
  const conds = ["k != ?"];
  const bind: unknown[] = [PINNED_KEY];
  if (like) {
    conds.push("k LIKE ? ESCAPE '\\'");
    bind.push(like);
  }
  if (onlyValid) conds.push("invalid_at IS NULL");
  const where = conds.join(" AND ");
  type Row = { no: number; k: string; invalid_at: number | null };
  const rows = db
    .prepare(
      `SELECT no, k, invalid_at FROM keys WHERE ${where}${after > 0 ? " AND no > ?" : ""} ORDER BY no LIMIT ? OFFSET ?`,
    )
    .all(...bind, ...(after > 0 ? [after] : []), limit + 1, after > 0 ? 0 : offset) as Row[];
  const totals = getTotals();
  const pinnedMatches = !q || PINNED_KEY.toLowerCase().includes(q);
  let filtered: number | null = null;
  let pinnedNo = 0;
  if (first) {
    if (like || onlyValid) {
      const c = db.prepare(`SELECT COUNT(*) AS c FROM keys WHERE ${where}`).get(...bind) as {
        c: number;
      };
      filtered = c.c + (pinnedMatches ? 1 : 0);
    } else filtered = totals.total;
    if (pinnedMatches)
      pinnedNo =
        (
          db.prepare("SELECT no FROM keys WHERE k = ?").get(PINNED_KEY) as
            | { no: number }
            | undefined
        )?.no ?? 0;
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

const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

export type MarkResult =
  | { ok: true; k: string; invalid: true; invalidAt: number }
  | { ok: false; error: "pinned" | "not found" | "rate" };

export async function markInvalid(k: string, ip: string): Promise<MarkResult> {
  if (k === PINNED_KEY) return { ok: false, error: "pinned" };
  const db = getDb();
  const ipHash = sha256Hex(ip);
  // One transaction: the rate check, the update and the report cannot interleave.
  return db
    .transaction((): MarkResult => {
      const row = db.prepare("SELECT invalid_at FROM keys WHERE k = ?").get(k) as
        | { invalid_at: number | null }
        | undefined;
      if (!row) return { ok: false, error: "not found" };
      if (row.invalid_at != null) return { ok: true, k, invalid: true, invalidAt: row.invalid_at };
      const now = nowS();
      const c = db
        .prepare("SELECT COUNT(*) AS c FROM invalid_reports WHERE ip = ? AND at >= ?")
        .get(ipHash, now - RATE_WINDOW_S) as { c: number };
      if (c.c >= RATE_MAX) return { ok: false, error: "rate" };
      db.prepare("UPDATE keys SET invalid_at = ?, status_at = ? WHERE k = ?").run(now, now, k);
      db.prepare("INSERT INTO invalid_reports (k, ip, at) VALUES (?, ?, ?)").run(k, ipHash, now);
      db.prepare("DELETE FROM invalid_reports WHERE at < ?").run(now - 86_400);
      totalsCache = null;
      return { ok: true, k, invalid: true, invalidAt: now };
    })
    .immediate();
}

export type UndoResult =
  | { ok: true; k: string; invalid: false }
  | { ok: false; error: "pinned" | "not found" | "undo window passed" };

export async function undoInvalid(k: string): Promise<UndoResult> {
  if (k === PINNED_KEY) return { ok: false, error: "pinned" };
  const db = getDb();
  return db
    .transaction((): UndoResult => {
      const row = db.prepare("SELECT invalid_at FROM keys WHERE k = ?").get(k) as
        | { invalid_at: number | null }
        | undefined;
      if (!row) return { ok: false, error: "not found" };
      if (row.invalid_at == null) return { ok: true, k, invalid: false };
      const now = nowS();
      if (row.invalid_at < now - UNDO_WINDOW_S) return { ok: false, error: "undo window passed" };
      db.prepare("UPDATE keys SET invalid_at = NULL, status_at = ? WHERE k = ?").run(now, k);
      totalsCache = null;
      return { ok: true, k, invalid: false };
    })
    .immediate();
}

export async function listInvalidSince(since: number) {
  const db = getDb();
  const now = nowS();
  if (since <= 0) {
    const r = db
      .prepare("SELECT k FROM keys WHERE invalid_at IS NOT NULL ORDER BY status_at LIMIT ?")
      .pluck()
      .all(INVALID_LIST_CAP) as string[];
    return { now, invalid: r, valid: [] as string[] };
  }
  const r = db
    .prepare("SELECT k, invalid_at FROM keys WHERE status_at >= ? ORDER BY status_at LIMIT ?")
    .all(since, INVALID_LIST_CAP) as { k: string; invalid_at: number | null }[];
  const invalid: string[] = [];
  const valid: string[] = [];
  for (const x of r) (x.invalid_at != null ? invalid : valid).push(x.k);
  return { now, invalid, valid };
}

export async function addKeys(input: unknown[]) {
  const db = getDb();
  const valid = new Set<string>();
  let invalid = 0;
  for (const raw of input) {
    const k = normalizeKey(raw);
    if (k) valid.add(k);
    else invalid++;
  }
  const list = [...valid];
  const now = nowS();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO keys (k, src, created_at) VALUES (?, 'user', ?)",
  );
  const added = db.transaction(() => {
    let n = 0;
    for (const k of list) n += insert.run(k, now).changes;
    return n;
  })();
  totalsCache = null;
  return { added, skipped: list.length - added, invalid };
}
