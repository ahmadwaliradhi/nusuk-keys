// Generates seed/keys-XX.sql chunk files from data/keys.json.
// Each file: <= ROWS_PER_FILE rows, multi-row INSERT OR IGNORE of ROWS_PER_STMT rows.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROWS_PER_FILE = 8000;
const ROWS_PER_STMT = 500;
const SEED_TS = 1700000000;

const keys = JSON.parse(readFileSync(join(root, "data/keys.json"), "utf8"));
const outDir = join(root, "seed");
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (/^keys-\d+\.sql$/.test(f)) rmSync(join(outDir, f));

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
let files = 0;
let rows = 0;
for (let i = 0; i < keys.length; i += ROWS_PER_FILE) {
  const chunk = keys.slice(i, i + ROWS_PER_FILE);
  const stmts = [];
  for (let j = 0; j < chunk.length; j += ROWS_PER_STMT) {
    const values = chunk
      .slice(j, j + ROWS_PER_STMT)
      .map((r) => `(${q(r.k)},${r.src ? q(r.src) : "NULL"},${SEED_TS})`)
      .join(",\n");
    stmts.push(`INSERT OR IGNORE INTO keys (k, src, created_at) VALUES\n${values};`);
  }
  const name = `keys-${String(files + 1).padStart(2, "0")}.sql`;
  writeFileSync(join(outDir, name), stmts.join("\n") + "\n");
  files++;
  rows += chunk.length;
}
console.log(`wrote ${files} files, ${rows} rows`);
