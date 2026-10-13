import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import type { SessionUser } from "@/server/auth/types";
import { hashPassword } from "@/server/auth/password";
import type { Role } from "@/domain/roles";
import { DomainError } from "@/server/errors";

let n = 0;
let cachedHash: string | null = null;
export const TEST_PASSWORD = "mot-de-passe-de-test-123";

export async function resetDb() {
  await db.execute(sql`TRUNCATE dossier_events, documents, dossiers, sessions, users RESTART IDENTITY CASCADE`);
}

export async function makeUser(role: Role, name?: string): Promise<SessionUser> {
  cachedHash ??= await hashPassword(TEST_PASSWORD);
  n++;
  const [u] = await db
    .insert(users)
    .values({ email: `user${n}-${role}@test.local`, fullName: name ?? `Test ${role} ${n}`, role, passwordHash: cachedHash })
    .returning();
  return { id: u!.id, email: u!.email, fullName: u!.fullName, role: u!.role, mustChangePassword: false };
}

export const COMPLETE_DATA = {
  cipCode: "1234567",
  siret: "90010009000092",
  ownerName: "Jean Dupont",
  pharmacyName: "Pharmacie de la Mairie",
  address: "12 rue de la République",
  postalCode: "13008",
  city: "Marseille",
  phone: "04 91 00 00 00",
  email: "contact@exemple.test",
  groupementType: "independante",
  paymentMethod: "traite",
  iban: "FR76 3000 6000 0112 3456 7890 189",
} as const;

export const PDF = Buffer.from("%PDF-1.4\n% fichier de test\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n", "latin1");
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

export async function expectDomainError(p: Promise<unknown>, code: DomainError["code"]) {
  try {
    await p;
  } catch (err) {
    if (err instanceof DomainError && err.code === code) return err;
    throw new Error(`Erreur attendue ${code}, reçue : ${(err as Error).name} ${(err as DomainError).code ?? ""} ${(err as Error).message}`);
  }
  throw new Error(`Erreur attendue ${code}, mais l'appel a réussi`);
}

let keyN = 0;
export function creationKey() {
  keyN++;
  return `cle-de-creation-test-${Date.now()}-${keyN}`;
}
