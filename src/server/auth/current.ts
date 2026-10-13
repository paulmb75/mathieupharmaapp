import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/domain/roles";
import { secureCookies } from "../env";
import { DomainError } from "../errors";
import { SESSION_COOKIE, validateSessionToken } from "./sessions";
import type { SessionUser } from "./types";

/** Utilisateur de la requête courante (mis en cache pour la durée du rendu). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

/** Pour les pages : redirige vers la connexion, ou vers l'accueil si le rôle ne convient pas. */
export async function requirePageUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

/** Pour les routes API : lève une erreur 401 / 403. */
export async function requireApiUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("UNAUTHENTICATED", "Session expirée. Veuillez vous reconnecter.");
  if (roles && !roles.includes(user.role)) throw new DomainError("FORBIDDEN", "Accès non autorisé.");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
