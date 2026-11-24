import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import Database from "better-sqlite3";
import { REMOTE, api, startServer, tempDir } from "./helpers.mjs";

const MIG = new URL("../migrations/", import.meta.url).pathname;
const sql = (name) => readFileSync(join(MIG, name), "utf8");

/** Builds a database the way a D1 export would leave it: schema, rows, and d1_migrations. */
function d1Export(dbPath, applied) {
  const db = new Database(dbPath);
  db.exec(
    "CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  );
  for (const name of applied) {
    db.exec(sql(name));
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
  }
  db.prepare("INSERT INTO keys (k, src, created_at) VALUES ('NG-userkey01', 'user', 1)").run();
  db.close();
}

const skip = REMOTE ? "starts its own servers" : false;

async function withServer(dbPath, fn, env) {
  const srv = await startServer({ dbPath, env });
  try {
    await fn(srv.base);
  } finally {
    await srv.stop();
  }
}

/** Marking a key invalid only works once migration 0002 is in place. */
async function assertFullSchema(base) {
  const r = await api(base, "/api/keys/invalid", { method: "POST", body: { k: "NG-userkey01" } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
}

describe("migrations at startup", { skip }, () => {
  test("a fresh database gets every migration", async () => {
    const t = tempDir();
    try {
      await withServer(t.dbPath, async (base) => {
        const r = await api(base, "/api/keys?limit=1");
        assert.equal(r.json.items[0].k, "NG-r8BBCPN4", "0002 inserts the pinned key");
        await api(base, "/api/keys", { method: "POST", body: { keys: ["NG-userkey01"] } });
        await assertFullSchema(base);
      });
    } finally {
      t.cleanup();
    }
  });

  test("a D1 export with only 0001 applied gets 0002 and keeps its rows", async () => {
    const t = tempDir();
    try {
      d1Export(t.dbPath, ["0001_init.sql"]);
      await withServer(t.dbPath, async (base) => {
        const r = await api(base, "/api/keys?q=ng-userkey01");
        assert.equal(r.json.items[0].k, "NG-userkey01");
        await assertFullSchema(base);
      });
    } finally {
      t.cleanup();
    }
  });

  test("a D1 export with both applied starts cleanly and re-runs nothing", async () => {
    const t = tempDir();
    try {
      d1Export(t.dbPath, ["0001_init.sql", "0002_invalid_pinned.sql"]);
      await withServer(t.dbPath, async (base) => {
        await assertFullSchema(base);
      });
      // and a second start is also clean
      await withServer(t.dbPath, async (base) => {
        const r = await api(base, "/api/keys?q=ng-userkey01");
        assert.equal(r.json.items[0].invalid, true);
      });
    } finally {
      t.cleanup();
    }
  });

  test("a failing migration stops the server from starting", async () => {
    const t = tempDir();
    try {
      const dir = join(t.dir, "migrations");
      mkdirSync(dir);
      writeFileSync(join(dir, "0001_init.sql"), sql("0001_init.sql"));
      writeFileSync(join(dir, "0002_broken.sql"), "CREATE TABLE nope (;");
      await assert.rejects(startServer({ dbPath: t.dbPath, env: { MIGRATIONS_DIR: dir } }), (e) => {
        assert.notEqual(e.code, 0);
        assert.match(e.output, /0002_broken\.sql/);
        return true;
      });
    } finally {
      t.cleanup();
    }
  });
});
