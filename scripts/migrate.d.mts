import type Database from "better-sqlite3";
export declare const DEFAULT_DB_PATH: string;
export declare const DEFAULT_MIGRATIONS_DIR: string;
export declare function openDatabase(path?: string): Database.Database;
export declare function migrate(db: Database.Database, dir?: string): string[];
