import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import Database from "better-sqlite3";
import { REMOTE, api, startServer, tempDir } from "./helpers.mjs";

const PINNED = "NG-r8BBCPN4";
const writes = { skip: REMOTE ? "read-only against BASE_URL" : false };

/** Distinct, well-formed keys: NG-T<tag><n>. */
const keys = (tag, n) =>
  Array.from({ length: n }, (_, i) => `NG-T${tag}${String(i).padStart(4, "0")}`);

let srv, tmp, base;
before(async () => {
  if (REMOTE) return void (base = REMOTE.replace(/\/$/, ""));
  tmp = tempDir();
  srv = await startServer({ dbPath: tmp.dbPath });
  base = srv.base;
});
after(async () => {
  await srv?.stop();
  tmp?.cleanup();
});

// Each write test uses its own client IP so the per-IP limits never couple tests.
let ipSeq = 0;
const nextIp = () => `198.51.100.${++ipSeq}`;

describe("GET /api/keys", () => {
  before(async () => {
    if (REMOTE) return;
    const r = await api(base, "/api/keys", {
      method: "POST",
      body: { keys: keys("L", 30) },
      ip: nextIp(),
    });
    assert.equal(r.status, 200);
  });

  test("first page starts with the pinned key and counts it", async () => {
    const r = await api(base, "/api/keys?limit=5");
    assert.equal(r.status, 200);
    assert.equal(r.json.items[0].k, PINNED);
    assert.equal(r.json.items[0].pinned, true);
    assert.ok(r.json.total >= 1);
    assert.equal(r.json.filtered, r.json.total);
    assert.equal(r.json.items.length, 6, "pinned + limit");
    assert.equal(r.json.hasMore, true);
    assert.equal(typeof r.json.now, "number");
  });

  test("pages by offset and by after without repeating keys", async () => {
    const p1 = await api(base, "/api/keys?limit=5");
    const rest1 = p1.json.items.filter((x) => !x.pinned);
    const byOffset = await api(base, "/api/keys?limit=5&offset=5");
    const byAfter = await api(base, `/api/keys?limit=5&after=${rest1.at(-1).no}`);
    assert.equal(
      byOffset.json.items.some((x) => x.pinned),
      false,
    );
    assert.deepEqual(
      byOffset.json.items.map((x) => x.k),
      byAfter.json.items.map((x) => x.k),
    );
    const seen = new Set(rest1.map((x) => x.k));
    for (const x of byAfter.json.items) assert.equal(seen.has(x.k), false);
    assert.equal(byAfter.json.filtered, null, "counts only on the first page");
  });

  test("search filters keys and counts matches", { skip: writes.skip }, async () => {
    const r2 = await api(base, "/api/keys?q=ng-tl001&limit=50");
    assert.equal(r2.json.filtered, 10);
    assert.equal(r2.json.items.length, 10);
    for (const x of r2.json.items) assert.match(x.k, /^NG-TL001\d$/);
  });

  test("search including the pinned key counts it", async () => {
    const r = await api(base, `/api/keys?q=${PINNED.toLowerCase()}`);
    assert.equal(r.json.items[0].k, PINNED);
    assert.ok(r.json.filtered >= 1);
  });

  test("valid=1 hides keys marked invalid", { skip: writes.skip }, async () => {
    const [k] = keys("L", 1);
    const m = await api(base, "/api/keys/invalid", { method: "POST", body: { k }, ip: nextIp() });
    assert.equal(m.status, 200);
    const all = await api(base, "/api/keys?q=ng-tl0000");
    assert.equal(all.json.items[0].invalid, true);
    const onlyValid = await api(base, "/api/keys?q=ng-tl0000&valid=1");
    assert.equal(onlyValid.json.items.length, 0);
    assert.equal(onlyValid.json.filtered, 0);
  });

  test("rejects an over-long query", async () => {
    const r = await api(base, `/api/keys?q=${"a".repeat(65)}`);
    assert.equal(r.status, 400);
    assert.deepEqual(r.json, { status: "error", error: "q too long" });
  });
});

describe("POST /api/keys", writes, () => {
  test("adds new keys, skips duplicates, rejects malformed, accepts links", async () => {
    const ks = keys("A", 3);
    const body = {
      keys: [...ks, ks[0], "bad key!", 42, `https://services.nusuk.sa/app/?p=27&id=NG-TAlink01`],
    };
    const r = await api(base, "/api/keys", { method: "POST", body, ip: nextIp() });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { status: "success", added: 4, skipped: 0, invalid: 2 });
    const again = await api(base, "/api/keys", {
      method: "POST",
      body: { keys: ks },
      ip: nextIp(),
    });
    assert.deepEqual(again.json, { status: "success", added: 0, skipped: 3, invalid: 0 });
    const list = await api(base, "/api/keys?q=ng-talink01");
    assert.equal(list.json.items[0].k, "NG-TAlink01");
  });

  test("rejects bad bodies", async () => {
    const ip = nextIp();
    const bad = await api(base, "/api/keys", { method: "POST", body: "{", ip });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error, "bad json");
    const empty = await api(base, "/api/keys", { method: "POST", body: { keys: [] }, ip });
    assert.equal(empty.status, 400);
    assert.equal(empty.json.error, "keys required");
  });

  test("enforces the key count and body size limits", async () => {
    const many = await api(base, "/api/keys", {
      method: "POST",
      body: { keys: Array.from({ length: 5001 }, () => "x") },
      ip: nextIp(),
    });
    assert.equal(many.status, 413);
    assert.equal(many.json.error, "max 5000 keys");
    const big = await api(base, "/api/keys", {
      method: "POST",
      body: { keys: ["NG-" + "a".repeat(300 * 1024)] },
      ip: nextIp(),
    });
    assert.equal(big.status, 413);
    assert.equal(big.json.error, "too large");
  });
});

describe("POST /api/keys rate limit", writes, () => {
  test("the 11th add request from one IP within ten minutes is refused", async () => {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      const r = await api(base, "/api/keys", {
        method: "POST",
        body: { keys: keys(`R${i}x`, 1) },
        ip,
      });
      assert.equal(r.status, 200, `request ${i + 1}`);
    }
    const r = await api(base, "/api/keys", {
      method: "POST",
      body: { keys: keys("Rlast", 1) },
      ip,
    });
    assert.equal(r.status, 429);
    assert.deepEqual(r.json, { status: "error", error: "rate" });
    const list = await api(base, "/api/keys?q=ng-trlast");
    assert.equal(list.json.items.length, 0, "refused request adds nothing");
    const other = await api(base, "/api/keys", {
      method: "POST",
      body: { keys: keys("Rlast", 1) },
      ip: nextIp(),
    });
    assert.equal(other.status, 200, "another IP is unaffected");
  });
});

describe("POST /api/keys/invalid", writes, () => {
  const ks = keys("I", 40);
  before(async () => {
    const r = await api(base, "/api/keys", { method: "POST", body: { keys: ks }, ip: nextIp() });
    assert.equal(r.json.added, 40);
  });

  test("marks a key invalid and undoes it", async () => {
    const ip = nextIp();
    const m = await api(base, "/api/keys/invalid", { method: "POST", body: { k: ks[0] }, ip });
    assert.equal(m.status, 200);
    assert.equal(m.json.status, "success");
    assert.equal(m.json.invalid, true);
    assert.equal(typeof m.json.invalidAt, "number");
    const u = await api(base, "/api/keys/invalid", {
      method: "POST",
      body: { k: ks[0], undo: true },
      ip,
    });
    assert.deepEqual(u.json, { status: "success", k: ks[0], invalid: false });
    const list = await api(base, `/api/keys?q=${ks[0].toLowerCase()}`);
    assert.equal(list.json.items[0].invalid, false);
  });

  test("the pinned key cannot be marked", async () => {
    const r = await api(base, "/api/keys/invalid", {
      method: "POST",
      body: { k: PINNED },
      ip: nextIp(),
    });
    assert.equal(r.status, 403);
    assert.deepEqual(r.json, { status: "error", error: "pinned" });
  });

  test("unknown and malformed keys are refused", async () => {
    const nf = await api(base, "/api/keys/invalid", {
      method: "POST",
      body: { k: "NG-nothere99" },
      ip: nextIp(),
    });
    assert.equal(nf.status, 404);
    const bad = await api(base, "/api/keys/invalid", {
      method: "POST",
      body: { k: "!" },
      ip: nextIp(),
    });
    assert.equal(bad.status, 400);
  });

  test("undo after the two-minute window fails", async () => {
    const k = ks[1];
    const m = await api(base, "/api/keys/invalid", { method: "POST", body: { k }, ip: nextIp() });
    assert.equal(m.status, 200);
    // Arrange: age the mark past the window (no clock control over the server process).
    const db = new Database(tmp.dbPath);
    db.prepare("UPDATE keys SET invalid_at = invalid_at - 121 WHERE k = ?").run(k);
    db.close();
    const u = await api(base, "/api/keys/invalid", {
      method: "POST",
      body: { k, undo: true },
      ip: nextIp(),
    });
    assert.equal(u.status, 409);
    assert.deepEqual(u.json, { status: "error", error: "undo window passed" });
  });

  test("the 31st mark from one IP within ten minutes is rate limited", async () => {
    const ip = nextIp();
    const targets = ks.slice(5, 36);
    for (const k of targets.slice(0, 30)) {
      const r = await api(base, "/api/keys/invalid", { method: "POST", body: { k }, ip });
      assert.equal(r.status, 200, k);
    }
    const r = await api(base, "/api/keys/invalid", {
      method: "POST",
      body: { k: targets[30] },
      ip,
    });
    assert.equal(r.status, 429);
    assert.deepEqual(r.json, { status: "error", error: "rate" });
    const other = await api(base, "/api/keys/invalid", {
      method: "POST",
      body: { k: targets[30] },
      ip: nextIp(),
    });
    assert.equal(other.status, 200, "another IP is unaffected");
  });
});

describe("GET /api/keys/invalid", () => {
  test("lists all invalid keys, then deltas since a time", { skip: writes.skip }, async () => {
    const ks = keys("D", 2);
    await api(base, "/api/keys", { method: "POST", body: { keys: ks }, ip: nextIp() });
    const ip = nextIp();
    const start = (await api(base, "/api/keys/invalid")).json;
    assert.equal(typeof start.now, "number");
    assert.ok(Array.isArray(start.invalid));
    await api(base, "/api/keys/invalid", { method: "POST", body: { k: ks[0] }, ip });
    await api(base, "/api/keys/invalid", { method: "POST", body: { k: ks[1] }, ip });
    await api(base, "/api/keys/invalid", { method: "POST", body: { k: ks[1], undo: true }, ip });
    const all = (await api(base, "/api/keys/invalid")).json;
    assert.ok(all.invalid.includes(ks[0]));
    assert.ok(!all.invalid.includes(ks[1]));
    const delta = (await api(base, `/api/keys/invalid?since=${start.now}`)).json;
    assert.ok(delta.invalid.includes(ks[0]));
    assert.ok(delta.valid.includes(ks[1]));
  });

  test("answers with the delta shape", async () => {
    const r = await api(base, "/api/keys/invalid?since=1");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json.invalid) && Array.isArray(r.json.valid));
  });
});

describe("answers", () => {
  test("GET /api/answers lists answers", async () => {
    const r = await api(base, "/api/answers?limit=3");
    assert.equal(r.status, 200);
    assert.ok(r.json.items.length > 0);
  });

  test("the answers page and old /soal links work", async () => {
    const page = await fetch(base + "/answers");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    for (const path of ["/soal", "/soal.php"]) {
      const r = await fetch(base + path, { redirect: "manual" });
      assert.ok([301, 302, 307, 308].includes(r.status), `${path} -> ${r.status}`);
      assert.match(r.headers.get("location"), /\/answers/);
    }
  });

  test("home page renders", async () => {
    const r = await fetch(base + "/");
    assert.equal(r.status, 200);
    assert.match(await r.text(), /<html/i);
  });
});
