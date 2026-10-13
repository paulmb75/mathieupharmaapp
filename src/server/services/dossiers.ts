import "server-only";
import { aliasedTable, and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  checkSubmission,
  DOSSIER_FIELDS,
  draftPatchSchema,
  type DossierData,
  type DossierField,
  type SubmissionCheck,
} from "@/domain/dossier";
import { compact, normalizeIban, normalizePhone, normalizeSiret } from "@/domain/formats";
import {
  availableActions,
  STATUSES,
  TRANSITIONS,
  type DossierEventType,
  type DossierStatus,
  type TransitionAction,
} from "@/domain/status";
import type { DocumentKind } from "@/domain/documents";
import { BUSINESS_CHECK_LABELS, BUSINESS_CHECKS } from "@/domain/adv";
import { db, type Tx } from "../db";
import { documents, dossierEvents, dossiers, users, type DossierRow } from "../db/schema";
import type { SessionUser } from "../auth/types";
import { DomainError } from "../errors";
import { canComment, canEditDossier, canReadDossier } from "./access";

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

export function toDossierData(row: DossierRow): DossierData {
  return Object.fromEntries(DOSSIER_FIELDS.map((f) => [f, row[f] ?? ""])) as DossierData;
}

/** Normalisation légère à l'enregistrement (espaces, casse) — les identifiants restent des chaînes. */
function normalizeField(field: DossierField, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  switch (field) {
    case "siret":
      return normalizeSiret(v);
    case "cipCode":
    case "postalCode":
      return compact(v);
    case "iban":
      return normalizeIban(v);
    case "phone":
      return normalizePhone(v);
    case "email":
      return v.toLowerCase();
    default:
      return v;
  }
}

function patchToColumns(patch: Record<string, string | undefined>): Partial<Record<DossierField, string | null>> {
  const out: Partial<Record<DossierField, string | null>> = {};
  for (const f of DOSSIER_FIELDS) {
    const v = patch[f];
    if (v !== undefined) out[f] = normalizeField(f, v);
  }
  if (out.groupementType === "independante") out.groupementName = null;
  return out;
}

async function activeDocumentCounts(dossierId: string, tx: Tx | typeof db = db): Promise<Record<DocumentKind, number>> {
  const rows = await tx
    .select({ kind: documents.kind, n: count() })
    .from(documents)
    .where(and(eq(documents.dossierId, dossierId), isNull(documents.removedAt)))
    .groupBy(documents.kind);
  const counts: Record<DocumentKind, number> = { KBIS: 0, RIB: 0 };
  for (const r of rows) counts[r.kind] = Number(r.n);
  return counts;
}

async function addEvent(
  tx: Tx,
  e: { dossierId: string; actorId: string; type: DossierEventType; from?: DossierStatus; to?: DossierStatus; message?: string | null },
) {
  await tx.insert(dossierEvents).values({
    dossierId: e.dossierId,
    actorId: e.actorId,
    type: e.type,
    fromStatus: e.from ?? null,
    toStatus: e.to ?? null,
    message: e.message ?? null,
  });
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Charge un dossier lisible par l'acteur ; « introuvable » sinon (sans révéler son existence). */
export async function loadReadableDossier(actor: SessionUser, id: string): Promise<DossierRow> {
  if (!z.uuid().safeParse(id).success) throw new DomainError("NOT_FOUND", "Dossier introuvable.");
  const [row] = await db.select().from(dossiers).where(eq(dossiers.id, id)).limit(1);
  if (!row || !canReadDossier(actor, row)) throw new DomainError("NOT_FOUND", "Dossier introuvable.");
  return row;
}

export type DocumentDTO = {
  id: string;
  kind: DocumentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedByName: string;
  removedAt: Date | null;
};

export type EventDTO = {
  id: string;
  type: DossierEventType;
  fromStatus: DossierStatus | null;
  toStatus: DossierStatus | null;
  message: string | null;
  createdAt: Date;
  actorName: string;
  actorRole: SessionUser["role"];
};

export type DossierDetail = {
  id: string;
  reference: string;
  status: DossierStatus;
  version: number;
  data: DossierData;
  ownerId: string;
  ownerName: string;
  quadraAccountRef: string | null;
  lastAdvMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  validatedAt: Date | null;
  quadraCreatedAt: Date | null;
  rejectedAt: Date | null;
  documents: DocumentDTO[];
  removedDocuments: DocumentDTO[];
  events: EventDTO[];
  actions: TransitionAction[];
  canEdit: boolean;
  canComment: boolean;
  submission: SubmissionCheck;
};

export async function getDossierDetail(actor: SessionUser, id: string): Promise<DossierDetail> {
  const row = await loadReadableDossier(actor, id);
  const [owner] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, row.ownerId));

  const uploader = aliasedTable(users, "uploader");
  const docs = await db
    .select({
      id: documents.id,
      kind: documents.kind,
      originalName: documents.originalName,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      createdAt: documents.createdAt,
      removedAt: documents.removedAt,
      uploadedByName: uploader.fullName,
    })
    .from(documents)
    .innerJoin(uploader, eq(uploader.id, documents.uploadedById))
    .where(eq(documents.dossierId, id))
    .orderBy(documents.createdAt);

  const events = await db
    .select({
      id: dossierEvents.id,
      type: dossierEvents.type,
      fromStatus: dossierEvents.fromStatus,
      toStatus: dossierEvents.toStatus,
      message: dossierEvents.message,
      createdAt: dossierEvents.createdAt,
      actorName: users.fullName,
      actorRole: users.role,
    })
    .from(dossierEvents)
    .innerJoin(users, eq(users.id, dossierEvents.actorId))
    .where(eq(dossierEvents.dossierId, id))
    .orderBy(desc(dossierEvents.createdAt));

  const active = docs.filter((d) => !d.removedAt);
  const counts = { KBIS: active.filter((d) => d.kind === "KBIS").length, RIB: active.filter((d) => d.kind === "RIB").length };
  const data = toDossierData(row);

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    version: row.version,
    data,
    ownerId: row.ownerId,
    ownerName: owner?.fullName ?? "—",
    quadraAccountRef: row.quadraAccountRef,
    lastAdvMessage: row.lastAdvMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    submittedAt: row.submittedAt,
    validatedAt: row.validatedAt,
    quadraCreatedAt: row.quadraCreatedAt,
    rejectedAt: row.rejectedAt,
    documents: active,
    // Les pièces retirées restent visibles pour l'ADV (traçabilité).
    removedDocuments: actor.role === "adv" ? docs.filter((d) => d.removedAt) : [],
    events,
    actions: availableActions(row.status, actor, row.ownerId),
    canEdit: canEditDossier(actor, row),
    canComment: canComment(actor, row),
    submission: checkSubmission(data, counts),
  };
}

export type DossierListItem = {
  id: string;
  reference: string;
  status: DossierStatus;
  pharmacyName: string | null;
  city: string | null;
  postalCode: string | null;
  siret: string | null;
  ownerName: string;
  lastAdvMessage: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
};

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  statuses: z.array(z.enum(STATUSES)).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  /** « queue » : plus ancienne transmission d'abord (traitement ADV dans l'ordre d'arrivée). */
  order: z.enum(["updated", "queue"]).optional(),
});

export async function listDossiers(
  actor: SessionUser,
  query: z.infer<typeof listQuerySchema> = {},
): Promise<DossierListItem[]> {
  const { q, statuses, limit = 100, order = "updated" } = listQuerySchema.parse(query);
  const conds: SQL[] = [];

  if (actor.role === "commercial") conds.push(eq(dossiers.ownerId, actor.id));
  else if (actor.role === "adv") conds.push(ne(dossiers.status, "DRAFT"));
  else throw new DomainError("FORBIDDEN", "Accès non autorisé.");

  if (statuses && statuses.length) conds.push(inArray(dossiers.status, statuses));
  if (q) {
    const term = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const siretTerm = `%${compact(q).replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(
      or(
        ilike(dossiers.pharmacyName, term),
        ilike(dossiers.city, term),
        ilike(dossiers.siret, siretTerm),
        ilike(dossiers.reference, term),
        ilike(dossiers.ownerName, term),
        ilike(dossiers.postalCode, term),
        ilike(users.fullName, term),
      )!,
    );
  }

  const docCount = sql<number>`(select count(*)::int from ${documents} where ${documents.dossierId} = ${dossiers.id} and ${documents.removedAt} is null)`;

  return db
    .select({
      id: dossiers.id,
      reference: dossiers.reference,
      status: dossiers.status,
      pharmacyName: dossiers.pharmacyName,
      city: dossiers.city,
      postalCode: dossiers.postalCode,
      siret: dossiers.siret,
      ownerName: users.fullName,
      lastAdvMessage: dossiers.lastAdvMessage,
      submittedAt: dossiers.submittedAt,
      createdAt: dossiers.createdAt,
      updatedAt: dossiers.updatedAt,
      documentCount: docCount,
    })
    .from(dossiers)
    .innerJoin(users, eq(users.id, dossiers.ownerId))
    .where(and(...conds))
    .orderBy(...(order === "queue" ? [asc(dossiers.submittedAt), asc(dossiers.createdAt)] : [desc(dossiers.updatedAt)]))
    .limit(limit);
}

export async function countByStatus(actor: SessionUser): Promise<Record<DossierStatus, number>> {
  const scope =
    actor.role === "commercial" ? eq(dossiers.ownerId, actor.id) : actor.role === "adv" ? ne(dossiers.status, "DRAFT") : sql`false`;
  const rows = await db.select({ status: dossiers.status, n: count() }).from(dossiers).where(scope).groupBy(dossiers.status);
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<DossierStatus, number>;
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

/** Statistiques de la semaine en cours (lundi 00:00, heure de Paris). */
export async function weekStats(actor: SessionUser): Promise<{ submitted: number; created: number }> {
  const weekStart = sql`(date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')`;
  const scope = actor.role === "commercial" ? eq(dossiers.ownerId, actor.id) : sql`true`;
  const rows = await db
    .select({ type: dossierEvents.type, n: count() })
    .from(dossierEvents)
    .innerJoin(dossiers, eq(dossiers.id, dossierEvents.dossierId))
    .where(
      and(
        scope,
        inArray(dossierEvents.type, ["submitted", "resubmitted", "quadra_created"]),
        sql`${dossierEvents.createdAt} >= ${weekStart}`,
      ),
    )
    .groupBy(dossierEvents.type);
  let submitted = 0;
  let created = 0;
  for (const r of rows) {
    if (r.type === "quadra_created") created += Number(r.n);
    else if (r.type === "submitted") submitted += Number(r.n);
  }
  return { submitted, created };
}

export type ActivityItem = EventDTO & { dossierId: string; reference: string; pharmacyName: string | null };

export async function listActivity(actor: SessionUser, limit = 50): Promise<ActivityItem[]> {
  const scope =
    actor.role === "commercial" ? eq(dossiers.ownerId, actor.id) : actor.role === "adv" ? ne(dossiers.status, "DRAFT") : sql`false`;
  return db
    .select({
      id: dossierEvents.id,
      type: dossierEvents.type,
      fromStatus: dossierEvents.fromStatus,
      toStatus: dossierEvents.toStatus,
      message: dossierEvents.message,
      createdAt: dossierEvents.createdAt,
      actorName: users.fullName,
      actorRole: users.role,
      dossierId: dossiers.id,
      reference: dossiers.reference,
      pharmacyName: dossiers.pharmacyName,
    })
    .from(dossierEvents)
    .innerJoin(dossiers, eq(dossiers.id, dossierEvents.dossierId))
    .innerJoin(users, eq(users.id, dossierEvents.actorId))
    .where(scope)
    .orderBy(desc(dossierEvents.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Écriture : brouillon
// ---------------------------------------------------------------------------

export const createDraftSchema = z.object({
  creationKey: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/),
  data: draftPatchSchema.optional(),
});

/**
 * Crée un brouillon. Idempotent grâce à la clé fournie par le client :
 * un double clic ou une nouvelle tentative après coupure réseau renvoie le même dossier.
 */
export async function createDraft(actor: SessionUser, input: unknown): Promise<{ id: string; version: number; created: boolean }> {
  if (actor.role !== "commercial") throw new DomainError("FORBIDDEN", "Seuls les commerciaux créent des demandes.");
  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("INVALID", "Données invalides.", z.flattenError(parsed.error));
  const { creationKey, data } = parsed.data;

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(dossiers)
      .values({ ownerId: actor.id, creationKey, ...patchToColumns(data ?? {}) })
      .onConflictDoNothing({ target: dossiers.creationKey })
      .returning({ id: dossiers.id, version: dossiers.version });
    if (inserted[0]) {
      await addEvent(tx, { dossierId: inserted[0].id, actorId: actor.id, type: "created", to: "DRAFT" });
      return { ...inserted[0], created: true };
    }
    const [existing] = await tx
      .select({ id: dossiers.id, version: dossiers.version, ownerId: dossiers.ownerId })
      .from(dossiers)
      .where(eq(dossiers.creationKey, creationKey));
    if (!existing || existing.ownerId !== actor.id) throw new DomainError("CONFLICT", "Clé de création déjà utilisée.");
    return { id: existing.id, version: existing.version, created: false };
  });
}

export const saveDraftSchema = z.object({
  version: z.number().int().min(1),
  data: draftPatchSchema,
});

/**
 * Enregistre les champs d'un dossier modifiable (brouillon ou retourné pour complément).
 * Verrou optimiste : la version envoyée doit correspondre, sinon conflit (autre onglet/appareil).
 */
export async function saveDraft(actor: SessionUser, id: string, input: unknown): Promise<{ version: number; updatedAt: Date }> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("INVALID", "Données invalides.", z.flattenError(parsed.error));
  const row = await loadReadableDossier(actor, id);
  if (!canEditDossier(actor, row)) {
    throw new DomainError(
      actor.role === "commercial" ? "CONFLICT" : "FORBIDDEN",
      "Ce dossier n’est plus modifiable : il a été transmis à l’ADV.",
      { status: row.status },
    );
  }
  const updated = await db
    .update(dossiers)
    .set({ ...patchToColumns(parsed.data.data), version: sql`${dossiers.version} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(dossiers.id, id),
        eq(dossiers.ownerId, actor.id),
        eq(dossiers.version, parsed.data.version),
        inArray(dossiers.status, ["DRAFT", "NEEDS_INFO"]),
      ),
    )
    .returning({ version: dossiers.version, updatedAt: dossiers.updatedAt });
  if (!updated[0]) {
    const [current] = await db.select({ version: dossiers.version, status: dossiers.status }).from(dossiers).where(eq(dossiers.id, id));
    throw new DomainError("CONFLICT", "Le dossier a été modifié depuis un autre écran. Rechargez la page.", current);
  }
  return updated[0];
}

/** Suppression d'un brouillon jamais transmis (par son propriétaire uniquement). */
export async function deleteDraft(actor: SessionUser, id: string): Promise<{ storageKeys: string[] }> {
  const row = await loadReadableDossier(actor, id);
  if (row.ownerId !== actor.id || row.status !== "DRAFT" || row.submittedAt) {
    throw new DomainError("FORBIDDEN", "Seul un brouillon jamais transmis peut être supprimé.");
  }
  return db.transaction(async (tx) => {
    const keys = await tx.select({ key: documents.storageKey }).from(documents).where(eq(documents.dossierId, id));
    const deleted = await tx
      .delete(dossiers)
      .where(and(eq(dossiers.id, id), eq(dossiers.status, "DRAFT")))
      .returning({ id: dossiers.id });
    if (!deleted[0]) throw new DomainError("CONFLICT", "Le dossier a changé de statut.");
    return { storageKeys: keys.map((k) => k.key) };
  });
}

// ---------------------------------------------------------------------------
// Écriture : transitions de statut
// ---------------------------------------------------------------------------

export const transitionSchema = z.object({
  message: z.string().trim().max(2000).optional(),
  quadraAccountRef: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9 ._\/-]{0,39}$/, "Référence de compte invalide (40 caractères maximum).")
    .optional(),
  checks: z.array(z.enum(BUSINESS_CHECKS)).optional(),
  /**
   * Statut affiché à l'utilisateur au moment de l'action. Si le dossier a changé entre-temps
   * (autre agent ADV, autre onglet), l'action est refusée au lieu de s'appliquer à l'aveugle.
   */
  expectedStatus: z.enum(STATUSES).optional(),
});

export type TransitionResult = { status: DossierStatus; alreadyApplied: boolean };

/**
 * Applique une transition de statut. Contrôles côté serveur :
 * rôle, propriété, statut de départ (table TRANSITIONS), pièces et champs obligatoires.
 * Le dossier est verrouillé (SELECT … FOR UPDATE) : deux soumissions simultanées
 * produisent une seule transition ; la seconde est signalée comme déjà appliquée.
 */
export async function applyTransition(
  actor: SessionUser,
  id: string,
  action: TransitionAction,
  input: unknown = {},
): Promise<TransitionResult> {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError("INVALID", parsed.error.issues[0]?.message ?? "Données invalides.", z.flattenError(parsed.error));
  }
  const { message, quadraAccountRef, checks, expectedStatus } = parsed.data;
  const rule = TRANSITIONS[action];

  // Vérification d'accès hors transaction (404 si non lisible).
  await loadReadableDossier(actor, id);

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(dossiers).where(eq(dossiers.id, id)).for("update");
    if (!row || !canReadDossier(actor, row)) throw new DomainError("NOT_FOUND", "Dossier introuvable.");

    if (actor.role !== rule.role || (rule.ownerOnly && row.ownerId !== actor.id)) {
      throw new DomainError("FORBIDDEN", "Action non autorisée pour votre rôle.");
    }
    if (row.status === rule.to && (!expectedStatus || rule.from.includes(expectedStatus))) {
      // Double clic / nouvelle tentative : l'action a déjà été appliquée.
      return { status: row.status, alreadyApplied: true };
    }
    if (!rule.from.includes(row.status) || (expectedStatus && expectedStatus !== row.status)) {
      throw new DomainError("CONFLICT", "Le dossier a changé de statut entre-temps. Rechargez la page.", {
        status: row.status,
      });
    }
    if (rule.requiresMessage && !message) {
      throw new DomainError(
        "INVALID",
        action === "reject" ? "Le motif du refus est obligatoire." : "Un commentaire est obligatoire pour demander un complément.",
      );
    }

    const now = new Date();
    const set: Partial<typeof dossiers.$inferInsert> = { status: rule.to, updatedAt: now };
    let eventType: DossierEventType;
    let eventMessage: string | null = message ?? null;

    switch (action) {
      case "submit": {
        const counts = await activeDocumentCounts(id, tx);
        const check = checkSubmission(toDossierData(row), counts);
        if (!check.ok) throw new DomainError("INVALID", "Le dossier est incomplet.", check);
        eventType = row.status === "NEEDS_INFO" ? "resubmitted" : "submitted";
        set.submittedAt = now;
        break;
      }
      case "request_info":
        eventType = "info_requested";
        set.lastAdvMessage = message;
        break;
      case "validate": {
        const missingChecks = BUSINESS_CHECKS.filter((c) => !checks?.includes(c));
        if (missingChecks.length) {
          throw new DomainError("INVALID", "Confirmez les vérifications métier avant de valider.", { missingChecks });
        }
        eventType = "validated";
        eventMessage = [`Vérifications : ${BUSINESS_CHECKS.map((c) => BUSINESS_CHECK_LABELS[c]).join(" ; ")}.`, message]
          .filter(Boolean)
          .join("\n");
        set.validatedAt = now;
        set.lastAdvMessage = null;
        break;
      }
      case "reject":
        eventType = "rejected";
        set.rejectedAt = now;
        set.lastAdvMessage = message;
        break;
      case "confirm_quadra":
        if (!quadraAccountRef) throw new DomainError("INVALID", "La référence du compte Quadra est obligatoire.");
        eventType = "quadra_created";
        eventMessage = [`Compte Quadra : ${quadraAccountRef}`, message].filter(Boolean).join("\n");
        set.quadraAccountRef = quadraAccountRef;
        set.quadraCreatedAt = now;
        break;
    }

    await tx.update(dossiers).set({ ...set, version: sql`${dossiers.version} + 1` }).where(eq(dossiers.id, id));
    await addEvent(tx, { dossierId: id, actorId: actor.id, type: eventType, from: row.status, to: rule.to, message: eventMessage });
    return { status: rule.to, alreadyApplied: false };
  });
}

// ---------------------------------------------------------------------------
// Commentaires
// ---------------------------------------------------------------------------

export const commentSchema = z.object({ message: z.string().trim().min(1, "Le commentaire est vide.").max(2000) });

export async function addComment(actor: SessionUser, id: string, input: unknown): Promise<void> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("INVALID", parsed.error.issues[0]?.message ?? "Commentaire invalide.");
  const row = await loadReadableDossier(actor, id);
  if (!canComment(actor, row)) throw new DomainError("FORBIDDEN", "Commentaire impossible sur ce dossier.");
  await db.transaction(async (tx) => {
    await addEvent(tx, { dossierId: id, actorId: actor.id, type: "comment", message: parsed.data.message });
    await tx.update(dossiers).set({ updatedAt: new Date() }).where(eq(dossiers.id, id));
  });
}
