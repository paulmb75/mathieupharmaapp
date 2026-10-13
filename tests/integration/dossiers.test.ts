import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { dossierEvents, dossiers } from "@/server/db/schema";
import {
  addComment,
  applyTransition,
  createDraft,
  deleteDraft,
  getDossierDetail,
  listDossiers,
  saveDraft,
} from "@/server/services/dossiers";
import { addDocument, readDocument, removeDocument } from "@/server/services/documents";
import { BUSINESS_CHECKS } from "@/domain/adv";
import { COMPLETE_DATA, creationKey, expectDomainError, makeUser, PDF, PNG, resetDb } from "../helpers";

beforeEach(resetDb);

async function completeDossier(owner: Awaited<ReturnType<typeof makeUser>>) {
  const { id } = await createDraft(owner, { creationKey: creationKey(), data: COMPLETE_DATA });
  await addDocument(owner, id, "KBIS", { name: "kbis.pdf", bytes: PDF });
  await addDocument(owner, id, "RIB", { name: "rib.png", bytes: PNG });
  return id;
}

describe("création et persistance des brouillons", () => {
  it("un brouillon incomplet est enregistré et retrouvé (nouvelle lecture, même utilisateur)", async () => {
    const paul = await makeUser("commercial");
    const { id, version } = await createDraft(paul, { creationKey: creationKey(), data: { pharmacyName: "Pharmacie du Cours" } });
    await saveDraft(paul, id, { version, data: { city: "Aix-en-Provence", postalCode: " 01000 " } });

    const list = await listDossiers(paul);
    expect(list.map((d) => d.id)).toContain(id);
    const detail = await getDossierDetail(paul, id);
    expect(detail.status).toBe("DRAFT");
    expect(detail.data.pharmacyName).toBe("Pharmacie du Cours");
    expect(detail.data.postalCode).toBe("01000"); // zéro initial préservé (chaîne)
    expect(detail.reference).toMatch(/^OUV-\d{5}$/);
    expect(detail.canEdit).toBe(true);
    expect(detail.submission.ok).toBe(false);
  });

  it("la création est idempotente (double clic, nouvelle tentative réseau)", async () => {
    const paul = await makeUser("commercial");
    const key = creationKey();
    const [a, b] = await Promise.all([
      createDraft(paul, { creationKey: key, data: { pharmacyName: "A" } }),
      createDraft(paul, { creationKey: key, data: { pharmacyName: "A" } }),
    ]);
    expect(a.id).toBe(b.id);
    const rows = await db.select().from(dossiers).where(eq(dossiers.ownerId, paul.id));
    expect(rows).toHaveLength(1);
  });

  it("une clé de création d'un autre commercial est refusée", async () => {
    const paul = await makeUser("commercial");
    const sophie = await makeUser("commercial");
    const key = creationKey();
    await createDraft(paul, { creationKey: key });
    await expectDomainError(createDraft(sophie, { creationKey: key }), "CONFLICT");
  });

  it("verrou optimiste : une version périmée est refusée", async () => {
    const paul = await makeUser("commercial");
    const { id, version } = await createDraft(paul, { creationKey: creationKey() });
    await saveDraft(paul, id, { version, data: { city: "Marseille" } });
    await expectDomainError(saveDraft(paul, id, { version, data: { city: "Toulon" } }), "CONFLICT");
    expect((await getDossierDetail(paul, id)).data.city).toBe("Marseille");
  });

  it("les champs inconnus et les valeurs de liste invalides sont rejetés", async () => {
    const paul = await makeUser("commercial");
    const { id, version } = await createDraft(paul, { creationKey: creationKey() });
    await expectDomainError(saveDraft(paul, id, { version, data: { status: "VALIDATED" } }), "INVALID");
    await expectDomainError(saveDraft(paul, id, { version, data: { paymentMethod: "espèces" } }), "INVALID");
    await expectDomainError(saveDraft(paul, id, { version, data: { comments: "x".repeat(2001) } }), "INVALID");
  });

  it("seuls les commerciaux créent des demandes", async () => {
    const adv = await makeUser("adv");
    const admin = await makeUser("admin");
    await expectDomainError(createDraft(adv, { creationKey: creationKey() }), "FORBIDDEN");
    await expectDomainError(createDraft(admin, { creationKey: creationKey() }), "FORBIDDEN");
  });
});

describe("permissions", () => {
  it("un commercial n'accède pas aux dossiers d'un autre (lecture, écriture, pièces)", async () => {
    const paul = await makeUser("commercial");
    const sophie = await makeUser("commercial");
    const id = await completeDossier(paul);
    const [docId] = (await getDossierDetail(paul, id)).documents.map((d) => d.id);

    await expectDomainError(getDossierDetail(sophie, id), "NOT_FOUND");
    await expectDomainError(saveDraft(sophie, id, { version: 1, data: { city: "X" } }), "NOT_FOUND");
    await expectDomainError(addDocument(sophie, id, "KBIS", { name: "k.pdf", bytes: PDF }), "NOT_FOUND");
    await expectDomainError(readDocument(sophie, docId!), "NOT_FOUND");
    await expectDomainError(removeDocument(sophie, docId!), "NOT_FOUND");
    await expectDomainError(applyTransition(sophie, id, "submit"), "NOT_FOUND");
    expect(await listDossiers(sophie)).toHaveLength(0);
  });

  it("l'ADV ne voit pas les brouillons, voit les dossiers transmis, ne modifie pas leur contenu", async () => {
    const paul = await makeUser("commercial");
    const adv = await makeUser("adv");
    const id = await completeDossier(paul);
    await expectDomainError(getDossierDetail(adv, id), "NOT_FOUND");
    expect(await listDossiers(adv)).toHaveLength(0);

    await applyTransition(paul, id, "submit");
    const detail = await getDossierDetail(adv, id);
    expect(detail.actions.sort()).toEqual(["reject", "request_info", "validate"]);
    const docId = detail.documents[0]!.id;
    expect((await readDocument(adv, docId)).bytes.length).toBeGreaterThan(0);
    await expectDomainError(saveDraft(adv, id, { version: detail.version, data: { city: "X" } }), "FORBIDDEN");
    await expectDomainError(addDocument(adv, id, "KBIS", { name: "k.pdf", bytes: PDF }), "FORBIDDEN");
    await expectDomainError(applyTransition(adv, id, "submit"), "FORBIDDEN");
  });

  it("l'administrateur n'a aucun accès aux dossiers", async () => {
    const paul = await makeUser("commercial");
    const admin = await makeUser("admin");
    const id = await completeDossier(paul);
    await applyTransition(paul, id, "submit");
    await expectDomainError(getDossierDetail(admin, id), "NOT_FOUND");
    await expectDomainError(listDossiers(admin), "FORBIDDEN");
  });

  it("un commercial ne peut pas valider son propre dossier", async () => {
    const paul = await makeUser("commercial");
    const id = await completeDossier(paul);
    await applyTransition(paul, id, "submit");
    await expectDomainError(applyTransition(paul, id, "validate", { checks: [...BUSINESS_CHECKS] }), "FORBIDDEN");
    await expectDomainError(applyTransition(paul, id, "confirm_quadra", { quadraAccountRef: "X1" }), "FORBIDDEN");
  });

  it("identifiants malformés : introuvable, sans erreur serveur", async () => {
    const paul = await makeUser("commercial");
    await expectDomainError(getDossierDetail(paul, "../../etc/passwd"), "NOT_FOUND");
    await expectDomainError(readDocument(paul, "pas-un-uuid"), "NOT_FOUND");
  });
});

describe("justificatifs obligatoires et contrôle des fichiers", () => {
  it("la transmission exige les champs obligatoires, le KBIS et le RIB", async () => {
    const paul = await makeUser("commercial");
    const { id } = await createDraft(paul, { creationKey: creationKey(), data: { pharmacyName: "Incomplète" } });
    const e1 = await expectDomainError(applyTransition(paul, id, "submit"), "INVALID");
    expect((e1.details as { missing: string[] }).missing).toContain("siret");

    const { id: id2 } = await createDraft(paul, { creationKey: creationKey(), data: COMPLETE_DATA });
    const e2 = await expectDomainError(applyTransition(paul, id2, "submit"), "INVALID");
    expect((e2.details as { missingDocuments: string[] }).missingDocuments).toEqual(["KBIS", "RIB"]);

    await addDocument(paul, id2, "KBIS", { name: "kbis.pdf", bytes: PDF });
    const e3 = await expectDomainError(applyTransition(paul, id2, "submit"), "INVALID");
    expect((e3.details as { missingDocuments: string[] }).missingDocuments).toEqual(["RIB"]);

    await addDocument(paul, id2, "RIB", { name: "rib.pdf", bytes: PDF });
    expect(await applyTransition(paul, id2, "submit")).toEqual({ status: "SUBMITTED", alreadyApplied: false });
  });

  it("un format invalide bloque la transmission", async () => {
    const paul = await makeUser("commercial");
    const { id } = await createDraft(paul, { creationKey: creationKey(), data: { ...COMPLETE_DATA, siret: "12345678901234" } });
    await addDocument(paul, id, "KBIS", { name: "kbis.pdf", bytes: PDF });
    await addDocument(paul, id, "RIB", { name: "rib.pdf", bytes: PDF });
    const err = await expectDomainError(applyTransition(paul, id, "submit"), "INVALID");
    expect((err.details as { invalid: { field: string }[] }).invalid.map((i) => i.field)).toEqual(["siret"]);
  });

  it("une pièce retirée ne compte plus pour la transmission", async () => {
    const paul = await makeUser("commercial");
    const id = await completeDossier(paul);
    const rib = (await getDossierDetail(paul, id)).documents.find((d) => d.kind === "RIB")!;
    await removeDocument(paul, rib.id);
    await expectDomainError(applyTransition(paul, id, "submit"), "INVALID");
    await expectDomainError(readDocument(paul, rib.id), "NOT_FOUND");
  });

  it("le type réel du fichier est contrôlé (contenu, pas extension) ainsi que la taille", async () => {
    const paul = await makeUser("commercial");
    const { id } = await createDraft(paul, { creationKey: creationKey() });
    await expectDomainError(addDocument(paul, id, "KBIS", { name: "kbis.pdf", bytes: Buffer.from("<html><script>alert(1)</script></html>") }), "INVALID");
    await expectDomainError(addDocument(paul, id, "KBIS", { name: "vide.pdf", bytes: Buffer.alloc(0) }), "INVALID");
    const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    await expectDomainError(addDocument(paul, id, "KBIS", { name: "gros.pdf", bytes: big }), "INVALID");
    await expectDomainError(addDocument(paul, id, "AUTRE", { name: "k.pdf", bytes: PDF }), "INVALID");
  });

  it("justificatif de plusieurs pages : plusieurs fichiers par type, nom de fichier assaini", async () => {
    const paul = await makeUser("commercial");
    const { id } = await createDraft(paul, { creationKey: creationKey() });
    await addDocument(paul, id, "KBIS", { name: "page1.png", bytes: PNG });
    await addDocument(paul, id, "KBIS", { name: "../../page2<>.png", bytes: PNG });
    const docs = (await getDossierDetail(paul, id)).documents;
    expect(docs).toHaveLength(2);
    expect(docs[1]!.originalName).toBe("page2.png");
    expect(docs[0]!.mimeType).toBe("image/png");
  });
});

describe("transitions et traitement ADV", () => {
  it("après transmission, le commercial ne modifie plus librement", async () => {
    const paul = await makeUser("commercial");
    const id = await completeDossier(paul);
    await applyTransition(paul, id, "submit");
    const d = await getDossierDetail(paul, id);
    expect(d.canEdit).toBe(false);
    await expectDomainError(saveDraft(paul, id, { version: d.version, data: { city: "X" } }), "CONFLICT");
    await expectDomainError(addDocument(paul, id, "KBIS", { name: "k.pdf", bytes: PDF }), "FORBIDDEN");
    await expectDomainError(removeDocument(paul, d.documents[0]!.id), "FORBIDDEN");
    await expectDomainError(deleteDraft(paul, id), "FORBIDDEN");
  });

  it("parcours complet : soumission → complément → correction → validation → création Quadra", async () => {
    const paul = await makeUser("commercial");
    const adv = await makeUser("adv");
    const id = await completeDossier(paul);
    await applyTransition(paul, id, "submit");

    await expectDomainError(applyTransition(adv, id, "request_info", {}), "INVALID");
    await applyTransition(adv, id, "request_info", { message: "RIB illisible" });
    let d = await getDossierDetail(paul, id);
    expect(d.status).toBe("NEEDS_INFO");
    expect(d.lastAdvMessage).toBe("RIB illisible");
    expect(d.canEdit).toBe(true);

    const rib = d.documents.find((x) => x.kind === "RIB")!;
    await removeDocument(paul, rib.id);
    await addDocument(paul, id, "RIB", { name: "rib-net.pdf", bytes: PDF });
    await saveDraft(paul, id, { version: d.version, data: { comments: "RIB remplacé" } });
    expect((await applyTransition(paul, id, "submit", { message: "Nouveau RIB joint" })).status).toBe("SUBMITTED");

    // L'ADV voit la pièce retirée (traçabilité).
    d = await getDossierDetail(adv, id);
    expect(d.removedDocuments.map((x) => x.id)).toContain(rib.id);

    await expectDomainError(applyTransition(adv, id, "confirm_quadra", { quadraAccountRef: "C0001" }), "CONFLICT");
    await expectDomainError(applyTransition(adv, id, "validate", { checks: ["kbis_conforme"] }), "INVALID");
    await applyTransition(adv, id, "validate", { checks: [...BUSINESS_CHECKS] });
    d = await getDossierDetail(adv, id);
    expect(d.status).toBe("VALIDATED");
    expect(d.quadraAccountRef).toBeNull();

    await expectDomainError(applyTransition(adv, id, "confirm_quadra", {}), "INVALID");
    await expectDomainError(applyTransition(adv, id, "confirm_quadra", { quadraAccountRef: "<script>" }), "INVALID");
    await applyTransition(adv, id, "confirm_quadra", { quadraAccountRef: "C0001" });
    d = await getDossierDetail(paul, id);
    expect(d.status).toBe("CREATED_IN_QUADRA");
    expect(d.quadraAccountRef).toBe("C0001");
    expect(d.actions).toEqual([]);

    const types = (await db.select().from(dossierEvents).where(eq(dossierEvents.dossierId, id))).map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(["created", "submitted", "info_requested", "resubmitted", "validated", "quadra_created", "document_removed"]),
    );
  });

  it("refus avec motif obligatoire ; statut final", async () => {
    const paul = await makeUser("commercial");
    const adv = await makeUser("adv");
    const id = await completeDossier(paul);
    await applyTransition(paul, id, "submit");
    await expectDomainError(applyTransition(adv, id, "reject", { message: "   " }), "INVALID");
    await applyTransition(adv, id, "reject", { message: "Déjà client" });
    const d = await getDossierDetail(paul, id);
    expect(d.status).toBe("REJECTED");
    expect(d.lastAdvMessage).toBe("Déjà client");
    await expectDomainError(applyTransition(adv, id, "validate", { checks: [...BUSINESS_CHECKS] }), "CONFLICT");
    await expectDomainError(applyTransition(paul, id, "submit"), "CONFLICT");
  });

  it("une action fondée sur un statut périmé est refusée", async () => {
    const paul = await makeUser("commercial");
    const adv = await makeUser("adv");
    const id = await completeDossier(paul);
    await applyTransition(paul, id, "submit");
    await applyTransition(adv, id, "validate", { checks: [...BUSINESS_CHECKS], expectedStatus: "SUBMITTED" });
    // Double clic sur « Valider » : déjà appliqué, pas d'erreur.
    expect(await applyTransition(adv, id, "validate", { checks: [...BUSINESS_CHECKS], expectedStatus: "SUBMITTED" })).toEqual({
      status: "VALIDATED",
      alreadyApplied: true,
    });
    // Un autre agent qui voyait encore « Soumis » ne peut pas refuser à l'aveugle.
    await expectDomainError(applyTransition(adv, id, "reject", { message: "x", expectedStatus: "SUBMITTED" }), "CONFLICT");
  });

  it("doubles soumissions simultanées : une seule transition enregistrée", async () => {
    const paul = await makeUser("commercial");
    const id = await completeDossier(paul);
    const results = await Promise.all(Array.from({ length: 5 }, () => applyTransition(paul, id, "submit")));
    expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    expect(results.every((r) => r.status === "SUBMITTED")).toBe(true);
    const events = await db
      .select()
      .from(dossierEvents)
      .where(and(eq(dossierEvents.dossierId, id), eq(dossierEvents.type, "submitted")));
    expect(events).toHaveLength(1);
  });

  it("doubles validations ADV simultanées : une seule transition", async () => {
    const paul = await makeUser("commercial");
    const adv = await makeUser("adv");
    const adv2 = await makeUser("adv");
    const id = await completeDossier(paul);
    await applyTransition(paul, id, "submit");
    const results = await Promise.allSettled([
      applyTransition(adv, id, "validate", { checks: [...BUSINESS_CHECKS], expectedStatus: "SUBMITTED" }),
      applyTransition(adv2, id, "reject", { message: "Concurrent", expectedStatus: "SUBMITTED" }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    const final = await getDossierDetail(adv, id);
    expect(["VALIDATED", "REJECTED"]).toContain(final.status);
  });

  it("commentaires : interdits sur un brouillon, possibles ensuite pour le commercial et l'ADV", async () => {
    const paul = await makeUser("commercial");
    const adv = await makeUser("adv");
    const id = await completeDossier(paul);
    await expectDomainError(addComment(paul, id, { message: "test" }), "FORBIDDEN");
    await applyTransition(paul, id, "submit");
    await addComment(paul, id, { message: "Pharmacie fermée le lundi" });
    await addComment(adv, id, { message: "Bien noté" });
    await expectDomainError(addComment(adv, id, { message: "" }), "INVALID");
    const d = await getDossierDetail(adv, id);
    expect(d.events.filter((e) => e.type === "comment")).toHaveLength(2);
  });

  it("suppression d'un brouillon par son propriétaire uniquement", async () => {
    const paul = await makeUser("commercial");
    const sophie = await makeUser("commercial");
    const { id } = await createDraft(paul, { creationKey: creationKey() });
    await expectDomainError(deleteDraft(sophie, id), "NOT_FOUND");
    await deleteDraft(paul, id);
    await expectDomainError(getDossierDetail(paul, id), "NOT_FOUND");
  });
});
