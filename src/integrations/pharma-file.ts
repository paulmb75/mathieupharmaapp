import type { IntegrationResult } from "./types";

/**
 * Fichier pharma consolidé — NON FOURNI.
 * Ses colonnes n'ont pas pu être inspectées : aucun mapping n'est supposé.
 * Le type de retour sera défini après lecture réelle du fichier.
 */
export interface PharmaDirectory {
  findByCip(cip: string): Promise<IntegrationResult<Record<string, string>>>;
  findBySiret(siret: string): Promise<IntegrationResult<Record<string, string>>>;
}

export const pharmaDirectory: PharmaDirectory = {
  async findByCip() {
    return { status: "not_configured", source: "Fichier pharma" };
  },
  async findBySiret() {
    return { status: "not_configured", source: "Fichier pharma" };
  },
};
