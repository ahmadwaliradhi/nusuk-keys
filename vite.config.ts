import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { migrate, openDatabase } from "./scripts/migrate.mjs";

/** `pnpm dev` applies the same migrations as `pnpm start`, against the same DB_PATH. */
const migrateOnDev = (): Plugin => ({
  name: "nusuk-migrate-on-dev",
  apply: "serve",
  configureServer() {
    const db = openDatabase();
    const applied = migrate(db);
    db.close();
    if (applied.length) console.log(`migrations applied: ${applied.join(", ")}`);
  },
});

export default defineConfig({
  resolve: { tsconfigPaths: true },
  ssr: { external: ["better-sqlite3"] },
  plugins: [migrateOnDev(), tanstackStart(), viteReact(), tailwindcss()],
});
