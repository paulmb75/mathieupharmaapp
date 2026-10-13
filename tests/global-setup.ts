import { rm } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadEnv } from "../scripts/load-env";

export default async function setup() {
  loadEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL manquant.");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL doit différer de DATABASE_URL.");
  const pool = new Pool({ connectionString: url });
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  await rm("./test-storage", { recursive: true, force: true });
  return async () => {
    await rm("./test-storage", { recursive: true, force: true });
  };
}
