import "server-only";
import { isEditableStatus, type DossierStatus } from "@/domain/status";
import type { SessionUser } from "../auth/types";

/**
 * Politique d'accès aux dossiers — appliquée par les services, donc par toutes les
 * routes et pages, et pas seulement dans l'interface.
 *
 * - Commercial : uniquement ses propres dossiers.
 * - ADV : tous les dossiers transmis (les brouillons restent privés au commercial).
 * - Administrateur : gestion des utilisateurs uniquement, aucun accès aux dossiers.
 */
export function canReadDossier(actor: SessionUser, d: { ownerId: string; status: DossierStatus }): boolean {
  if (actor.role === "commercial") return d.ownerId === actor.id;
  if (actor.role === "adv") return d.status !== "DRAFT";
  return false;
}

export function canEditDossier(actor: SessionUser, d: { ownerId: string; status: DossierStatus }): boolean {
  return actor.role === "commercial" && d.ownerId === actor.id && isEditableStatus(d.status);
}

export function canComment(actor: SessionUser, d: { ownerId: string; status: DossierStatus }): boolean {
  if (d.status === "DRAFT") return false;
  return canReadDossier(actor, d);
}
