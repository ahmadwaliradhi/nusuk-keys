import { createFileRoute } from "@tanstack/react-router";
import { listInvalidSince, markInvalid, normalizeKey, undoInvalid } from "~/lib/keys-db";

const MAX_INVALID_BODY = 4096;

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });

export const Route = createFileRoute("/api/keys/invalid")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const n = Number.parseInt(u.searchParams.get("since") ?? "", 10);
        const since = Number.isFinite(n) && n > 0 ? n : 0;
        try {
          return json(await listInvalidSince(since));
        } catch (e) {
          console.error("listInvalidSince failed", e);
          return json({ status: "error", error: "db" }, 500);
        }
      },
      POST: async ({ request }) => {
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_INVALID_BODY) return json({ status: "error", error: "too large" }, 413);
        const text = await request.text();
        if (text.length > MAX_INVALID_BODY)
          return json({ status: "error", error: "too large" }, 413);
        let body: { k?: unknown; undo?: unknown };
        try {
          body = JSON.parse(text);
        } catch {
          return json({ status: "error", error: "bad json" }, 400);
        }
        const k = normalizeKey(body?.k);
        if (!k) return json({ status: "error", error: "bad key" }, 400);
        try {
          if (body.undo === true) {
            const r = await undoInvalid(k);
            if (r.ok) return json({ status: "success", k: r.k, invalid: false });
            const code =
              r.error === "pinned"
                ? 403
                : r.error === "not found"
                  ? 404
                  : r.error === "unavailable"
                    ? 503
                    : 409;
            return json({ status: "error", error: r.error }, code);
          }
          const ip = request.headers.get("cf-connecting-ip") || "unknown";
          const r = await markInvalid(k, ip);
          if (r.ok)
            return json({ status: "success", k: r.k, invalid: true, invalidAt: r.invalidAt });
          const code =
            r.error === "pinned"
              ? 403
              : r.error === "not found"
                ? 404
                : r.error === "unavailable"
                  ? 503
                  : 429;
          return json({ status: "error", error: r.error }, code);
        } catch (e) {
          console.error("invalid failed", e);
          return json({ status: "error", error: "db" }, 500);
        }
      },
    },
  },
});
