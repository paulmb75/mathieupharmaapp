/**
 * Serveur dédié aux tests de bout en bout : base de TEST réinitialisée, données fictives,
 * stockage séparé. N'utilise jamais la base de développement.
 */
import { execSync, spawn } from "node:child_process";
import { loadEnv } from "./load-env";

loadEnv();
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || testUrl === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL manquant ou identique à DATABASE_URL.");

const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  STORAGE_DIR: "./test-storage/e2e",
  APP_ENV: "development",
  DEMO_MODE: "true",
  APP_URL: "http://localhost:3100",
  NEXT_TELEMETRY_DISABLED: "1",
};
execSync("npx tsx scripts/reset.ts && npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts", { stdio: "inherit", env });
const child = spawn("npx", ["next", "dev", "-p", "3100"], { stdio: "inherit", env });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
