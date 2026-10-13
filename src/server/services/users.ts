import "server-only";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { ROLES } from "@/domain/roles";
import { db } from "../db";
import { users } from "../db/schema";
import type { SessionUser } from "../auth/types";
import { DomainError } from "../errors";
import { hashPassword, passwordPolicyError, verifyPassword } from "../auth/password";
import { normalizeEmail } from "../auth/login";
import { invalidateUserSessions } from "../auth/sessions";

function requireAdmin(actor: SessionUser) {
  if (actor.role !== "admin") throw new DomainError("FORBIDDEN", "Réservé aux administrateurs.");
}

export type UserListItem = {
  id: string;
  email: string;
  fullName: string;
  role: (typeof ROLES)[number];
  active: boolean;
  mustChangePassword: boolean;
  lockedUntil: Date | null;
  createdAt: Date;
};

export async function listUsers(actor: SessionUser): Promise<UserListItem[]> {
  requireAdmin(actor);
  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.fullName));
}

const passwordSchema = z.string().superRefine((v, ctx) => {
  const err = passwordPolicyError(v);
  if (err) ctx.addIssue({ code: "custom", message: err });
});

export const createUserSchema = z.object({
  email: z.email("Adresse e-mail invalide.").max(160),
  fullName: z.string().trim().min(2, "Nom complet requis.").max(120),
  role: z.enum(ROLES),
  temporaryPassword: passwordSchema,
});

export async function createUser(actor: SessionUser, input: unknown): Promise<{ id: string }> {
  requireAdmin(actor);
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("INVALID", parsed.error.issues[0]?.message ?? "Données invalides.");
  const { email, fullName, role, temporaryPassword } = parsed.data;
  const inserted = await db
    .insert(users)
    .values({
      email: normalizeEmail(email),
      fullName,
      role,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (!inserted[0]) throw new DomainError("CONFLICT", "Un utilisateur existe déjà avec cette adresse e-mail.");
  return inserted[0];
}

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  temporaryPassword: passwordSchema.optional(),
});

export async function updateUser(actor: SessionUser, userId: string, input: unknown): Promise<void> {
  requireAdmin(actor);
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("INVALID", parsed.error.issues[0]?.message ?? "Données invalides.");
  if (!z.uuid().safeParse(userId).success) throw new DomainError("NOT_FOUND", "Utilisateur introuvable.");
  const { fullName, role, active, temporaryPassword } = parsed.data;

  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!target) throw new DomainError("NOT_FOUND", "Utilisateur introuvable.");
    const losesAdmin = target.role === "admin" && target.active && ((role && role !== "admin") || active === false);
    if (losesAdmin) {
      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, userId)));
      if (Number(n) === 0) throw new DomainError("CONFLICT", "Impossible : il doit rester au moins un administrateur actif.");
    }
    await tx
      .update(users)
      .set({
        ...(fullName ? { fullName } : {}),
        ...(role ? { role } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(temporaryPassword
          ? { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  });
  // Changement de rôle, désactivation ou réinitialisation : les sessions ouvertes sont fermées.
  if (role || active === false || temporaryPassword) await invalidateUserSessions(userId);
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis."),
  newPassword: passwordSchema,
});

export async function changeOwnPassword(actor: SessionUser, input: unknown): Promise<void> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("INVALID", parsed.error.issues[0]?.message ?? "Données invalides.");
  const [user] = await db.select().from(users).where(eq(users.id, actor.id));
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    throw new DomainError("INVALID", "Mot de passe actuel incorrect.");
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    throw new DomainError("INVALID", "Le nouveau mot de passe doit être différent de l’actuel.");
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false, updatedAt: new Date() })
    .where(eq(users.id, actor.id));
}
