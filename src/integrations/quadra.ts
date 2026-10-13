import type { IntegrationResult } from "./types";

/**
 * Quadra — AUCUNE écriture dans le MVP.
 *
 * Règles connues (à confirmer) :
 * - Rechercher un prospect existant et conserver son numéro de compte.
 * - Sinon, attribuer un numéro selon la séquence de l'entreprise, de manière atomique,
 *   par le système qui fait autorité (jamais « maximum + 1 » côté client).
 * - Identifiant actuel : nom du titulaire + code postal (normalisation à confirmer,
 *   voir `proposeQuadraIdentifier` dans src/domain/dossier.ts).
 * - Code de règlement « L » = traite lorsqu'un RIB est présent (conditions à confirmer).
 *
 * Aujourd'hui, l'ADV crée le compte manuellement dans Quadra puis confirme la création
 * dans l'application en saisissant la référence du compte.
 */
export interface QuadraGateway {
  findProspect(query: { siret?: string; identifier?: string }): Promise<IntegrationResult<{ accountNumber: string }>>;
  /** Réservation atomique d'un numéro de compte par Quadra (non implémentée). */
  reserveAccountNumber(): Promise<IntegrationResult<{ accountNumber: string }>>;
}

export const quadraGateway: QuadraGateway = {
  async findProspect() {
    return { status: "not_configured", source: "Quadra" };
  },
  async reserveAccountNumber() {
    return { status: "not_configured", source: "Quadra" };
  },
};
