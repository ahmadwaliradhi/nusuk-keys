import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/** Set BASE_URL to run read-only cases against an already running server (cutover check). */
export const REMOTE = process.env.BASE_URL || "";

export function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "nusuk-keys-test-"));
  return {
    dir,
    dbPath: join(dir, "test.db"),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** Runs `node scripts/<script>` to completion. Resolves with { code, output }. */
export function runScript(script, env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [join(ROOT, "scripts", script)], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    p.stdout.on("data", (d) => (output += d));
    p.stderr.on("data", (d) => (output += d));
    p.on("exit", (code) => resolve({ code, output }));
  });
}

/**
 * Starts the built server (`node scripts/start.mjs`) on a free port against `dbPath`.
 * Resolves once it answers, or rejects with its output if it exits first.
 */
export async function startServer({ dbPath, env = {} }) {
  const port = await freePort();
  const p = spawn(process.execPath, [join(ROOT, "scripts", "start.mjs")], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DB_PATH: dbPath, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  p.stdout.on("data", (d) => (output += d));
  p.stderr.on("data", (d) => (output += d));
  const exited = new Promise((resolve) => p.on("exit", (code) => resolve(code)));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15_000;
  for (;;) {
    const code = await Promise.race([
      exited,
      new Promise((r) => setTimeout(() => r(undefined), 100)),
    ]);
    if (code !== undefined)
      throw Object.assign(new Error(`server exited ${code}\n${output}`), { code, output });
    try {
      const r = await fetch(`${base}/api/keys?limit=1`);
      if (r.ok) break;
    } catch {}
    if (Date.now() > deadline) {
      p.kill();
      throw new Error(`server did not start\n${output}`);
    }
  }
  return {
    base,
    output: () => output,
    stop: async () => {
      p.kill();
      await exited;
    },
  };
}

export async function api(base, path, { method = "GET", body, ip } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (ip) headers["x-forwarded-for"] = ip;
  const r = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, json, text, headers: r.headers };
}
