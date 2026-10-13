/**
 * Données de DÉMONSTRATION — exclusivement fictives.
 * Refusé si APP_ENV=production ou si la base contient des comptes non fictifs.
 */
import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { notLike, sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { LocalDocumentStorage } from "../src/server/storage/local";
import { fictitiousPdf } from "./demo-pdf";
import { loadEnv } from "./load-env";

loadEnv();

const DEMO_DOMAIN = "@demo.mathieu-pharma.test";
/** IBAN d'exemple de la documentation bancaire française (format valide, compte fictif). */
const DEMO_IBAN = "FR7630006000011234567890189";

function luhnSiret(prefix13: string): string {
  for (let d = 0; d <= 9; d++) {
    const s = prefix13 + d;
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let n = Number(s[13 - i]);
      if (i % 2 === 1) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
    }
    if (sum % 10 === 0) return s;
  }
  throw new Error("SIRET impossible");
}

const days = (n: number, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 15, 0, 0);
  return d;
};

async function main() {
  if ((process.env.APP_ENV ?? "development") === "production") {
    throw new Error("Refusé : les données de démonstration sont interdites lorsque APP_ENV=production.");
  }
  const password = process.env.DEMO_PASSWORD ?? "";
  if (password.length < 12) throw new Error("DEMO_PASSWORD doit contenir au moins 12 caractères (voir .env.example).");
  const url = process.argv.includes("--test") ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant.");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  const { users, dossiers, documents, dossierEvents, sessions } = schema;

  const real = await db.select({ id: users.id }).from(users).where(notLike(users.email, `%${DEMO_DOMAIN}`)).limit(1);
  if (real.length) throw new Error("Refusé : la base contient des comptes non fictifs. Utilisez une base dédiée à la démonstration.");

  await db.execute(sql`TRUNCATE ${dossierEvents}, ${documents}, ${dossiers}, ${sessions}, ${users} RESTART IDENTITY CASCADE`);
  await db.execute(sql`ALTER SEQUENCE dossier_reference_seq RESTART WITH 1`);
  const storageDir = process.env.STORAGE_DIR ?? "./storage/documents";
  await rm(path.resolve(storageDir), { recursive: true, force: true });
  const storage = new LocalDocumentStorage(storageDir);

  const hash = await hashPassword(password);
  const mk = (fullName: string, local: string, role: (typeof schema.roleEnum.enumValues)[number]) => ({
    fullName,
    email: local + DEMO_DOMAIN,
    role,
    passwordHash: hash,
  });
  const [paul, sophie, claire] = await db
    .insert(users)
    .values([
      mk("Paul Martin", "paul.martin", "commercial"),
      mk("Sophie Durand", "sophie.durand", "commercial"),
      mk("Claire Bernard", "claire.adv", "adv"),
      mk("Admin Démo", "admin", "admin"),
    ])
    .returning();

  type Status = (typeof schema.statusEnum.enumValues)[number];
  type Ev = { type: (typeof schema.eventTypeEnum.enumValues)[number]; by: typeof paul; at: Date; from?: Status; to?: Status; message?: string };

  async function addDossier(opts: {
    owner: typeof paul;
    status: Status;
    data: Partial<typeof dossiers.$inferInsert>;
    docs: ("KBIS" | "RIB")[];
    createdAt: Date;
    events: Ev[];
    extra?: Partial<typeof dossiers.$inferInsert>;
  }) {
    const last = opts.events[opts.events.length - 1]?.at ?? opts.createdAt;
    const [d] = await db
      .insert(dossiers)
      .values({ ownerId: opts.owner!.id, status: opts.status, ...opts.data, ...opts.extra, createdAt: opts.createdAt, updatedAt: last })
      .returning();
    for (const kind of opts.docs) {
      const bytes = fictitiousPdf(kind === "KBIS" ? "Extrait KBIS" : "Releve d'identite bancaire", [
        `Pharmacie : ${opts.data.pharmacyName}`,
        `Titulaire : ${opts.data.ownerName}`,
        kind === "KBIS" ? `SIRET : ${opts.data.siret}` : `IBAN : ${DEMO_IBAN} (exemple)`,
      ]);
      const key = randomUUID();
      await storage.put(key, bytes);
      await db.insert(documents).values({
        dossierId: d!.id,
        kind,
        originalName: kind === "KBIS" ? "kbis_pharmacie.pdf" : "rib_pharmacie.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        storageKey: key,
        uploadedById: opts.owner!.id,
        createdAt: new Date(opts.createdAt.getTime() + 3600 * 1000),
      });
    }
    for (const e of opts.events) {
      await db.insert(dossierEvents).values({
        dossierId: d!.id,
        actorId: e.by!.id,
        type: e.type,
        fromStatus: e.from ?? null,
        toStatus: e.to ?? null,
        message: e.message ?? null,
        createdAt: e.at,
      });
    }
  }

  const base = (name: string, owner: string, city: string, cp: string, address: string, siretPrefix: string, cip: string) => ({
    pharmacyName: name,
    ownerName: owner,
    city,
    postalCode: cp,
    address,
    siret: luhnSiret(siretPrefix),
    cipCode: cip,
    phone: "0491000000",
    groupementType: "independante",
    paymentMethod: "traite",
    iban: DEMO_IBAN,
  });

  // 1. À compléter (RIB illisible) — Paul
  await addDossier({
    owner: paul,
    status: "NEEDS_INFO",
    data: { ...base("Pharmacie de la Mairie", "Jean Dupont", "Marseille", "13008", "12 rue de la République", "9001000100001", "1234567"), email: "contact@pharmacie-mairie.demo", comments: "Fermée le lundi matin." },
    docs: ["KBIS", "RIB"],
    createdAt: days(6),
    extra: { submittedAt: days(5), lastAdvMessage: "RIB illisible : merci de joindre une photo nette ou le PDF de la banque." },
    events: [
      { type: "created", by: paul, at: days(6), to: "DRAFT" },
      { type: "document_added", by: paul, at: days(6, 11), message: "KBIS de la pharmacie — kbis_pharmacie.pdf" },
      { type: "document_added", by: paul, at: days(6, 11), message: "RIB de la pharmacie — rib_pharmacie.pdf" },
      { type: "submitted", by: paul, at: days(5), from: "DRAFT", to: "SUBMITTED" },
      { type: "info_requested", by: claire, at: days(1, 9), from: "SUBMITTED", to: "NEEDS_INFO", message: "RIB illisible : merci de joindre une photo nette ou le PDF de la banque." },
    ],
  });

  // 2. Brouillon incomplet — Paul
  await addDossier({
    owner: paul,
    status: "DRAFT",
    data: { pharmacyName: "Pharmacie du Cours", city: "Aix-en-Provence", postalCode: "13100", ownerName: "Marie Lefèvre" },
    docs: [],
    createdAt: days(0, 8),
    events: [{ type: "created", by: paul, at: days(0, 8), to: "DRAFT" }],
  });

  // 3. Soumis à l'ADV — Paul
  await addDossier({
    owner: paul,
    status: "SUBMITTED",
    data: { ...base("Pharmacie Saint-Jean", "Luc Moreau", "Vitrolles", "13127", "4 avenue Jean Moulin", "9001000200002", "2345678"), groupementType: "groupement", groupementName: "Groupement fictif Démo" },
    docs: ["KBIS", "RIB"],
    createdAt: days(3),
    extra: { submittedAt: days(2) },
    events: [
      { type: "created", by: paul, at: days(3), to: "DRAFT" },
      { type: "submitted", by: paul, at: days(2), from: "DRAFT", to: "SUBMITTED" },
    ],
  });

  // 4. Créé dans Quadra — Paul
  await addDossier({
    owner: paul,
    status: "CREATED_IN_QUADRA",
    data: base("Pharmacie du Soleil", "Anne Girard", "Marseille", "13001", "27 la Canebière", "9001000300003", "3456789"),
    docs: ["KBIS", "RIB"],
    createdAt: days(9),
    extra: { submittedAt: days(8), validatedAt: days(7), quadraCreatedAt: days(7, 15), quadraAccountRef: "DEMO-000123" },
    events: [
      { type: "created", by: paul, at: days(9), to: "DRAFT" },
      { type: "submitted", by: paul, at: days(8), from: "DRAFT", to: "SUBMITTED" },
      { type: "validated", by: claire, at: days(7), from: "SUBMITTED", to: "VALIDATED", message: "Vérifications : pièces conformes (démonstration)." },
      { type: "quadra_created", by: claire, at: days(7, 15), from: "VALIDATED", to: "CREATED_IN_QUADRA", message: "Compte Quadra : DEMO-000123" },
    ],
  });

  // 5. Validé, création Quadra en attente — Sophie
  await addDossier({
    owner: sophie,
    status: "VALIDATED",
    data: base("Pharmacie des Calanques", "Hugo Petit", "Cassis", "13260", "2 quai des Moulins", "9001000400004", "4567890"),
    docs: ["KBIS", "RIB"],
    createdAt: days(4),
    extra: { submittedAt: days(4, 16), validatedAt: days(0, 9) },
    events: [
      { type: "created", by: sophie, at: days(4), to: "DRAFT" },
      { type: "submitted", by: sophie, at: days(4, 16), from: "DRAFT", to: "SUBMITTED" },
      { type: "validated", by: claire, at: days(0, 9), from: "SUBMITTED", to: "VALIDATED", message: "Vérifications : pièces conformes (démonstration)." },
    ],
  });

  // 6. Soumis — Sophie
  await addDossier({
    owner: sophie,
    status: "SUBMITTED",
    data: { ...base("Pharmacie du Port", "Inès Roux", "La Ciotat", "13600", "8 boulevard Anatole France", "9001000500005", "5678901"), paymentMethod: "virement" },
    docs: ["KBIS", "RIB"],
    createdAt: days(1),
    extra: { submittedAt: days(1, 15) },
    events: [
      { type: "created", by: sophie, at: days(1), to: "DRAFT" },
      { type: "submitted", by: sophie, at: days(1, 15), from: "DRAFT", to: "SUBMITTED" },
    ],
  });

  // 7. Refusé — Sophie
  await addDossier({
    owner: sophie,
    status: "REJECTED",
    data: base("Pharmacie de l’Étang", "Paul Fabre", "Martigues", "13500", "15 rue Lamartine", "9001000600006", "6789012"),
    docs: ["KBIS", "RIB"],
    createdAt: days(12),
    extra: { submittedAt: days(11), rejectedAt: days(10), lastAdvMessage: "Pharmacie déjà cliente sous un autre SIRET (exemple fictif)." },
    events: [
      { type: "created", by: sophie, at: days(12), to: "DRAFT" },
      { type: "submitted", by: sophie, at: days(11), from: "DRAFT", to: "SUBMITTED" },
      { type: "rejected", by: claire, at: days(10), from: "SUBMITTED", to: "REJECTED", message: "Pharmacie déjà cliente sous un autre SIRET (exemple fictif)." },
    ],
  });

  await pool.end();
  console.log("Données de démonstration créées (fictives). Comptes :");
  for (const u of ["paul.martin", "sophie.durand", "claire.adv", "admin"]) console.log(`  - ${u}${DEMO_DOMAIN}`);
  console.log("Mot de passe : valeur de DEMO_PASSWORD.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
