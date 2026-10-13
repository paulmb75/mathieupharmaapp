import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { authenticate } from "@/server/auth/login";
import { createSession, invalidateSession, validateSessionToken } from "@/server/auth/sessions";
import { changeOwnPassword, createUser, listUsers, updateUser } from "@/server/services/users";
import { expectDomainError, makeUser, resetDb, TEST_PASSWORD } from "../helpers";

beforeEach(resetDb);

describe("authentification et sessions", () => {
  it("connexion, session valide, déconnexion", async () => {
    const paul = await makeUser("commercial");
    const { userId } = await authenticate(paul.email.toUpperCase(), TEST_PASSWORD);
    expect(userId).toBe(paul.id);
    const { token } = await createSession(userId);
    expect((await validateSessionToken(token))?.id).toBe(paul.id);
    await invalidateSession(token);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("le jeton n'est pas stocké en clair", async () => {
    const paul = await makeUser("commercial");
    const { token } = await createSession(paul.id);
    const rows = await db.execute<{ id: string }>(`select id from sessions`);
    expect(rows.rows.map((r) => r.id)).not.toContain(token);
  });

  it("message générique et verrouillage après 5 échecs", async () => {
    const paul = await makeUser("commercial");
    const unknown = await expectDomainError(authenticate("inconnu@test.local", "x"), "UNAUTHENTICATED");
    const wrong = await expectDomainError(authenticate(paul.email, "mauvais"), "UNAUTHENTICATED");
    expect(unknown.message).toBe(wrong.message);
    for (let i = 0; i < 4; i++) await expectDomainError(authenticate(paul.email, "mauvais"), "UNAUTHENTICATED");
    await expectDomainError(authenticate(paul.email, TEST_PASSWORD), "TOO_MANY_REQUESTS");
  });

  it("un compte désactivé ne peut plus se connecter et ses sessions sont invalidées", async () => {
    const admin = await makeUser("admin");
    const paul = await makeUser("commercial");
    const { token } = await createSession(paul.id);
    await updateUser(admin, paul.id, { active: false });
    expect(await validateSessionToken(token)).toBeNull();
    await expectDomainError(authenticate(paul.email, TEST_PASSWORD), "UNAUTHENTICATED");
  });
});

describe("gestion des utilisateurs (administrateur)", () => {
  it("réservée aux administrateurs", async () => {
    const paul = await makeUser("commercial");
    const adv = await makeUser("adv");
    await expectDomainError(listUsers(paul), "FORBIDDEN");
    await expectDomainError(listUsers(adv), "FORBIDDEN");
    await expectDomainError(updateUser(adv, paul.id, { role: "admin" }), "FORBIDDEN");
  });

  it("création avec mot de passe temporaire, doublon refusé, politique de mot de passe", async () => {
    const admin = await makeUser("admin");
    await expectDomainError(createUser(admin, { email: "x@test.local", fullName: "X Y", role: "adv", temporaryPassword: "court" }), "INVALID");
    await createUser(admin, { email: "Claire@Test.local", fullName: "Claire B", role: "adv", temporaryPassword: "temporaire-123456" });
    await expectDomainError(
      createUser(admin, { email: "claire@test.local", fullName: "Claire B", role: "adv", temporaryPassword: "temporaire-123456" }),
      "CONFLICT",
    );
    const [u] = await db.select().from(users).where(eq(users.email, "claire@test.local"));
    expect(u?.mustChangePassword).toBe(true);
    expect(u?.passwordHash).not.toContain("temporaire");
  });

  it("le changement de rôle ferme les sessions ; le dernier administrateur est protégé", async () => {
    const admin = await makeUser("admin");
    const paul = await makeUser("commercial");
    const { token } = await createSession(paul.id);
    await updateUser(admin, paul.id, { role: "adv" });
    expect(await validateSessionToken(token)).toBeNull();
    await expectDomainError(updateUser(admin, admin.id, { role: "commercial" }), "CONFLICT");
    await expectDomainError(updateUser(admin, admin.id, { active: false }), "CONFLICT");
  });

  it("changement de son propre mot de passe", async () => {
    const paul = await makeUser("commercial");
    await expectDomainError(changeOwnPassword(paul, { currentPassword: "faux", newPassword: "nouveau-mot-de-passe" }), "INVALID");
    await changeOwnPassword(paul, { currentPassword: TEST_PASSWORD, newPassword: "nouveau-mot-de-passe" });
    await authenticate(paul.email, "nouveau-mot-de-passe");
  });
});
