// Production entry: apply pending migrations, then serve the built app.
// Env: PORT (3000), HOST (0.0.0.0), DB_PATH, MIGRATIONS_DIR.
import { fileURLToPath } from "node:url";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import { migrate, openDatabase } from "./migrate.mjs";

try {
  const db = openDatabase();
  const applied = migrate(db);
  db.close();
  console.log(
    applied.length ? `migrations applied: ${applied.join(", ")}` : "migrations: up to date",
  );
} catch (e) {
  console.error(e);
  process.exit(1);
}

const { default: app } = await import("../dist/server/server.js");
const clientDir = fileURLToPath(new URL("../dist/client", import.meta.url));

const server = serve({
  port: Number(process.env.PORT || 3000),
  hostname: process.env.HOST || "0.0.0.0",
  middleware: [staticMiddleware({ dir: clientDir })],
  fetch: (request) => app.fetch(request),
  gracefulShutdown: true,
  silent: true,
});
await server.ready();
console.log(`listening on ${server.url}`);
