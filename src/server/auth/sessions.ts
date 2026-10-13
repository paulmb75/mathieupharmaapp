import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "mp_session";
const SESSION_DAYS = 14;
const RENEW_THRESHOLD_DAYS = 7;
const DAY = 24 * 3600 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  // Nettoyage opportuniste des sessions expirées.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

/** Valide un jeton : session non expirée ET utilisateur actif. Prolonge la session (glissante). */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const rows = await db
    .select({
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        active: users.active,
        mustChangePassword: users.mustChangePassword,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || !row.user.active) return null;
  if (row.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_DAYS * DAY) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) })
      .where(eq(sessions.id, id));
  }
  return {
    id: row.user.id,
    email: row.user.email,
    fullName: row.user.fullName,
    role: row.user.role,
    mustChangePassword: row.user.mustChangePassword,
  };
}

export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
