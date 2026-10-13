import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { DomainError } from "../errors";
import { hashPassword, verifyPassword } from "./password";

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

let dummyHash: Promise<string> | null = null;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Vérifie les identifiants. Message d'erreur générique pour ne pas révéler
 * l'existence d'un compte ; verrouillage temporaire après 5 échecs.
 */
export async function authenticate(emailInput: string, password: string): Promise<{ userId: string }> {
  const email = normalizeEmail(emailInput);
  const generic = new DomainError("UNAUTHENTICATED", "Adresse e-mail ou mot de passe incorrect.");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    // Calcul factice pour un temps de réponse comparable.
    dummyHash ??= hashPassword("mot-de-passe-factice");
    await verifyPassword(password, await dummyHash);
    throw generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new DomainError(
      "TOO_MANY_REQUESTS",
      "Trop de tentatives. Réessayez dans quelques minutes ou contactez l’administrateur.",
    );
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await db
      .update(users)
      .set({
        failedLoginCount: sql`${users.failedLoginCount} + 1`,
        lockedUntil: sql`CASE WHEN ${users.failedLoginCount} + 1 >= ${MAX_FAILURES}
          THEN now() + make_interval(mins => ${LOCK_MINUTES}) ELSE NULL END`,
      })
      .where(eq(users.id, user.id));
    throw generic;
  }
  if (!user.active) throw generic;
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
  return { userId: user.id };
}
