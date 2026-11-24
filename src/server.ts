import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { ensureSchema } from "~/lib/keys-db";

const fetch = createStartHandler(defaultStreamHandler);

export default {
  fetch,
  // Cron trigger (wrangler.jsonc "triggers"): applies pending schema migration 0002
  // once D1 accepts writes again. A no-op read once the schema is current.
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(
      ensureSchema().then(
        (r) => console.log("ensureSchema:", r),
        (e) => console.error("ensureSchema failed:", e),
      ),
    );
  },
};
