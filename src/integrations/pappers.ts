import type { IntegrationResult } from "./types";

/**
 * Pappers — aucun accès fourni. Aucun endpoint n'est codé ici : l'implémentation
 * se fera à partir de la documentation officielle et d'une clé API stockée côté serveur.
 */
export interface CompanyRegistry {
  lookupSiret(siret: string): Promise<
    IntegrationResult<{ legalName: string; address?: string; postalCode?: string; city?: string; managers?: string[] }>
  >;
}

export const companyRegistry: CompanyRegistry = {
  async lookupSiret() {
    return { status: "not_configured", source: "Pappers" };
  },
};
