import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { databaseUrl } from "../env";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __mpPool?: Pool; __mpDb?: Db };

function createDb(): Db {
  const pool = globalForDb.__mpPool ?? new Pool({ connectionString: databaseUrl(), max: 10 });
  globalForDb.__mpPool = pool;
  // Pas de logger de requêtes : les paramètres peuvent contenir des données bancaires.
  return drizzle(pool, { schema });
}

export const db: Db = globalForDb.__mpDb ?? (globalForDb.__mpDb = createDb());

export async function closeDb(): Promise<void> {
  await globalForDb.__mpPool?.end();
  globalForDb.__mpPool = undefined;
  globalForDb.__mpDb = undefined;
}

export { schema };
