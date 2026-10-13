/**
 * Vérifications MÉTIER confirmées par l'ADV avant validation.
 * Elles complètent les contrôles de format automatiques (SIRET, IBAN…) qui ne prouvent
 * ni l'identité de l'entreprise ni la titularité du compte bancaire.
 */
export const BUSINESS_CHECKS = ["kbis_conforme", "rib_titulaire"] as const;
export type BusinessCheck = (typeof BUSINESS_CHECKS)[number];

export const BUSINESS_CHECK_LABELS: Record<BusinessCheck, string> = {
  kbis_conforme: "KBIS de moins de 3 mois, cohérent avec la pharmacie (raison sociale, SIRET, adresse)",
  rib_titulaire: "RIB au nom de la pharmacie ou de son titulaire, IBAN identique à celui saisi",
};
