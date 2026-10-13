/**
 * Crée un utilisateur (typiquement le premier administrateur en production).
 * Usage : npm run user:create -- --email prenom.nom@entreprise.fr --name "Prénom Nom" --role admin
 * Un mot de passe temporaire aléatoire est affiché une seule fois ; il devra être changé.
 */
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { ROLES, type Role } from "../src/domain/roles";
import { loadEnv } from "./load-env";

loadEnv();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const fullName = arg("name")?.trim();
  const role = arg("role") as Role | undefined;
  if (!email || !fullName || !role || !ROLES.includes(role)) {
    throw new Error('Usage : npm run user:create -- --email x@y.fr --name "Prénom Nom" --role commercial|adv|admin');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const temp = randomBytes(12).toString("base64url");
  const inserted = await drizzle(pool)
    .insert(users)
    .values({ email, fullName, role, passwordHash: await hashPassword(temp), mustChangePassword: true })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  await pool.end();
  if (!inserted.length) throw new Error("Un utilisateur existe déjà avec cette adresse.");
  console.log(`Utilisateur créé : ${email} (${role})`);
  console.log(`Mot de passe temporaire (affiché une seule fois) : ${temp}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
