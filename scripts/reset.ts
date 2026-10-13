/** Réinitialise la base LOCALE (supprime toutes les tables). Refusé en production. */
import { Pool } from "pg";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  if ((process.env.APP_ENV ?? "development") === "production") throw new Error("Refusé lorsque APP_ENV=production.");
  const url = process.argv.includes("--test") ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error("URL de base de données manquante.");
  const pool = new Pool({ connectionString: url });
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await pool.end();
  console.log("Base réinitialisée.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
