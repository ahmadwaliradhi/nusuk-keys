import { createFileRoute } from "@tanstack/react-router";
import { listAnswers } from "~/lib/answers";
import { MAX_LIMIT, MAX_Q } from "~/lib/keys-db";

const int = (v: string | null, d: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export const Route = createFileRoute("/api/answers")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const u = new URL(request.url);
        const q = (u.searchParams.get("q") ?? "").trim();
        const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
        if (q.length > MAX_Q)
          return Response.json({ error: "q too long" }, { status: 400, headers });
        const limit = Math.min(Math.max(int(u.searchParams.get("limit"), 20), 1), MAX_LIMIT);
        const offset = Math.min(int(u.searchParams.get("offset"), 0), 100_000);
        return Response.json(listAnswers(offset, limit, q), { headers });
      },
    },
  },
});
