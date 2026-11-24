// Loads seed/keys-*.sql into DB_PATH (after applying migrations). Re-runnable: inserts are OR IGNORE.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { migrate, openDatabase } from "./migrate.mjs";

const dir = new URL("../seed/", import.meta.url).pathname;
const db = openDatabase();
migrate(db);
const files = readdirSync(dir)
  .filter((f) => /^keys-.*\.sql$/.test(f))
  .sort();
for (const f of files) {
  db.transaction(() => db.exec(readFileSync(join(dir, f), "utf8")))();
  console.log(`seeded ${f}`);
}
const n = db.prepare("SELECT COUNT(*) AS c FROM keys").get().c;
db.close();
console.log(`keys: ${n}`);
