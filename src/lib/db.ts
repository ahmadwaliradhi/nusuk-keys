import type Database from "better-sqlite3";
import { openDatabase } from "../../scripts/migrate.mjs";

let db: Database.Database | null = null;

/** The process-wide SQLite handle (opened on first use; migrations run at process start). */
export function getDb(): Database.Database {
  db ??= openDatabase();
  return db;
}
