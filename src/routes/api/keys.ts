import { createFileRoute } from "@tanstack/react-router";
import {
  MAX_BODY_BYTES,
  MAX_KEYS_PER_REQUEST,
  MAX_LIMIT,
  MAX_Q,
  addKeys,
  listKeys,
} from "~/lib/keys-db";

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });

const int = (v: string | null, d: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export const Route = createFileRoute("/api/keys")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const q = (u.searchParams.get("q") ?? "").trim().toLowerCase();
        if (q.length > MAX_Q) return json({ status: "error", error: "q too long" }, 400);
        const limit = Math.min(Math.max(int(u.searchParams.get("limit"), 100), 1), MAX_LIMIT);
        const offset = Math.min(int(u.searchParams.get("offset"), 0), 1_000_000);
        const after = int(u.searchParams.get("after"), 0);
        const valid = u.searchParams.get("valid") === "1";
        try {
          return json(await listKeys({ offset, after, limit, q, valid }));
        } catch (e) {
          console.error("listKeys failed", e);
          return json({ status: "error", error: "db" }, 500);
        }
      },
      POST: async ({ request }) => {
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_BODY_BYTES) return json({ status: "error", error: "too large" }, 413);
        const text = await request.text();
        if (text.length > MAX_BODY_BYTES) return json({ status: "error", error: "too large" }, 413);
        let body: { keys?: unknown };
        try {
          body = JSON.parse(text);
        } catch {
          return json({ status: "error", error: "bad json" }, 400);
        }
        if (!body || !Array.isArray(body.keys) || body.keys.length === 0)
          return json({ status: "error", error: "keys required" }, 400);
        if (body.keys.length > MAX_KEYS_PER_REQUEST)
          return json({ status: "error", error: `max ${MAX_KEYS_PER_REQUEST} keys` }, 413);
        try {
          return json({ status: "success", ...(await addKeys(body.keys)) });
        } catch (e) {
          console.error("addKeys failed", e);
          return json({ status: "error", error: "db" }, 500);
        }
      },
    },
  },
});
