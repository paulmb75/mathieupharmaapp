import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  DOCUMENT_KINDS,
  DOCUMENT_LABELS,
  MAX_FILE_BYTES,
  MAX_FILES_PER_KIND,
  type AcceptedMimeType,
  type DocumentKind,
} from "@/domain/documents";
import { db } from "../db";
import { documents, dossierEvents, dossiers, type DocumentRow } from "../db/schema";
import type { SessionUser } from "../auth/types";
import { DomainError, logError } from "../errors";
import { getStorage } from "../storage";
import { canEditDossier, canReadDossier } from "./access";
import { loadReadableDossier } from "./dossiers";

/**
 * Détermine le type réel du fichier à partir de ses premiers octets.
 * Le type annoncé par le navigateur et l'extension ne sont pas fiables.
 */
export function sniffMimeType(buf: Buffer): AcceptedMimeType | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "").trim();
  return (clean || "document").slice(0, 150);
}

export type UploadedDocument = {
  id: string;
  kind: DocumentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export const documentKindSchema = z.enum(DOCUMENT_KINDS);

export async function addDocument(
  actor: SessionUser,
  dossierId: string,
  kindInput: unknown,
  file: { name: string; bytes: Buffer },
): Promise<UploadedDocument> {
  const kind = documentKindSchema.safeParse(kindInput);
  if (!kind.success) throw new DomainError("INVALID", "Type de justificatif inconnu.");
  const dossier = await loadReadableDossier(actor, dossierId);
  if (!canEditDossier(actor, dossier)) {
    throw new DomainError("FORBIDDEN", "Les pièces de ce dossier ne sont plus modifiables.");
  }
  if (file.bytes.length === 0) throw new DomainError("INVALID", "Le fichier est vide.");
  if (file.bytes.length > MAX_FILE_BYTES) {
    throw new DomainError("INVALID", `Fichier trop volumineux (${MAX_FILE_BYTES / 1024 / 1024} Mo maximum).`);
  }
  const mimeType = sniffMimeType(file.bytes);
  if (!mimeType) throw new DomainError("INVALID", "Format non accepté. Formats acceptés : PDF, JPEG, PNG, WEBP, HEIC.");

  const storageKey = randomUUID();
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const originalName = sanitizeFileName(file.name);
  const storage = getStorage();
  await storage.put(storageKey, file.bytes);

  try {
    return await db.transaction(async (tx) => {
      // Re-vérification sous verrou : le dossier a pu être transmis entre-temps.
      const [locked] = await tx.select().from(dossiers).where(eq(dossiers.id, dossierId)).for("update");
      if (!locked || !canEditDossier(actor, locked)) {
        throw new DomainError("FORBIDDEN", "Les pièces de ce dossier ne sont plus modifiables.");
      }
      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(documents)
        .where(and(eq(documents.dossierId, dossierId), eq(documents.kind, kind.data), isNull(documents.removedAt)));
      if (Number(n) >= MAX_FILES_PER_KIND) {
        throw new DomainError("INVALID", `${MAX_FILES_PER_KIND} pages maximum par justificatif.`);
      }
      const [doc] = await tx
        .insert(documents)
        .values({
          dossierId,
          kind: kind.data,
          originalName,
          mimeType,
          sizeBytes: file.bytes.length,
          sha256,
          storageKey,
          uploadedById: actor.id,
        })
        .returning({
          id: documents.id,
          kind: documents.kind,
          originalName: documents.originalName,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          createdAt: documents.createdAt,
        });
      await tx.insert(dossierEvents).values({
        dossierId,
        actorId: actor.id,
        type: "document_added",
        message: `${DOCUMENT_LABELS[kind.data]} — ${originalName}`,
      });
      await tx
        .update(dossiers)
        .set({ updatedAt: new Date() })
        .where(eq(dossiers.id, dossierId));
      return doc!;
    });
  } catch (err) {
    await storage.delete(storageKey).catch((e) => logError("documents.cleanup", e));
    throw err;
  }
}

async function loadDocument(actor: SessionUser, documentId: string): Promise<{ doc: DocumentRow; dossier: typeof dossiers.$inferSelect }> {
  if (!z.uuid().safeParse(documentId).success) throw new DomainError("NOT_FOUND", "Document introuvable.");
  const [row] = await db
    .select({ doc: documents, dossier: dossiers })
    .from(documents)
    .innerJoin(dossiers, eq(dossiers.id, documents.dossierId))
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!row || !canReadDossier(actor, row.dossier)) throw new DomainError("NOT_FOUND", "Document introuvable.");
  // Une pièce retirée n'est consultable que par l'ADV.
  if (row.doc.removedAt && actor.role !== "adv") throw new DomainError("NOT_FOUND", "Document introuvable.");
  return row;
}

/** Retrait logique d'une pièce (le fichier est conservé pour la traçabilité ADV). */
export async function removeDocument(actor: SessionUser, documentId: string): Promise<void> {
  const { doc, dossier } = await loadDocument(actor, documentId);
  if (!canEditDossier(actor, dossier)) throw new DomainError("FORBIDDEN", "Les pièces de ce dossier ne sont plus modifiables.");
  if (doc.removedAt) return;
  await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(dossiers).where(eq(dossiers.id, dossier.id)).for("update");
    if (!locked || !canEditDossier(actor, locked)) throw new DomainError("FORBIDDEN", "Les pièces de ce dossier ne sont plus modifiables.");
    await tx
      .update(documents)
      .set({ removedAt: new Date(), removedById: actor.id })
      .where(and(eq(documents.id, documentId), isNull(documents.removedAt)));
    await tx.insert(dossierEvents).values({
      dossierId: dossier.id,
      actorId: actor.id,
      type: "document_removed",
      message: `${DOCUMENT_LABELS[doc.kind as DocumentKind]} — ${doc.originalName}`,
    });
    await tx
      .update(dossiers)
      .set({ updatedAt: new Date() })
      .where(eq(dossiers.id, dossier.id));
  });
}

export async function readDocument(
  actor: SessionUser,
  documentId: string,
): Promise<{ bytes: Buffer; mimeType: string; originalName: string }> {
  const { doc } = await loadDocument(actor, documentId);
  const bytes = await getStorage().get(doc.storageKey);
  return { bytes, mimeType: doc.mimeType, originalName: doc.originalName };
}
