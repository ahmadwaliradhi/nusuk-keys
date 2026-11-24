import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";

export const DEFAULT_DB_PATH = ".data/nusuk-keys.db";
export const DEFAULT_MIGRATIONS_DIR = "migrations";

/** Opens the SQLite file with the pragmas every process uses. Creates the parent directory. */
export function openDatabase(path = process.env.DB_PATH || DEFAULT_DB_PATH) {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}

/**
 * Applies every `*.sql` file in `dir`, in name order, that `_migrations` has not recorded.
 * Each file runs in its own transaction. A database imported from a D1 export carries
 * `d1_migrations`; when `_migrations` is empty its names are copied across first so
 * already-applied migrations (0002 uses ALTER TABLE ADD COLUMN) are not re-run.
 * Throws on the first failure. Returns the names applied.
 */
export function migrate(db, dir = process.env.MIGRATIONS_DIR || DEFAULT_MIGRATIONS_DIR) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const count = db.prepare("SELECT COUNT(*) AS c FROM _migrations").get().c;
  const hasD1 = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'")
    .get();
  if (count === 0 && hasD1) {
    db.prepare(
      "INSERT OR IGNORE INTO _migrations (name, applied_at) SELECT name, unixepoch() FROM d1_migrations WHERE name IS NOT NULL",
    ).run();
  }
  const done = new Set(db.prepare("SELECT name FROM _migrations").pluck().all());
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const record = db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, unixepoch())");
  const applied = [];
  for (const name of files) {
    if (done.has(name)) continue;
    const sql = readFileSync(join(dir, name), "utf8");
    try {
      db.transaction(() => {
        db.exec(sql);
        record.run(name);
      })();
    } catch (e) {
      throw new Error(`migration ${name} failed: ${e.message}`, { cause: e });
    }
    applied.push(name);
  }
  return applied;
}
