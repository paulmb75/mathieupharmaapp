import { z } from "zod";
import {
  isValidCip,
  isValidEmail,
  isValidIban,
  isValidPhone,
  isValidPostalCode,
  isValidSiret,
} from "./formats";

/**
 * Champs métier d'une demande d'ouverture de compte.
 *
 * PROVISOIRE : le formulaire officiel d'ouverture de compte n'a pas été fourni.
 * Les champs et les obligations ci-dessous combinent le mockup (champs marqués *)
 * et la liste transmise par la direction. À réviser dès réception du formulaire.
 */

export const GROUPEMENT_TYPES = ["independante", "groupement"] as const;
export type GroupementType = (typeof GROUPEMENT_TYPES)[number];
export const GROUPEMENT_LABELS: Record<GroupementType, string> = {
  independante: "Indépendante",
  groupement: "Membre d’un groupement",
};

/**
 * Modes de règlement — liste PROVISOIRE à confirmer avec l'ADV.
 * Règle Quadra connue : le code « L » correspond à la traite lorsqu'un RIB est présent
 * (conditions exactes à confirmer). Aucune conversion automatique n'est faite ici.
 */
export const PAYMENT_METHODS = ["traite", "virement", "cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  traite: "Traite (LCR)",
  virement: "Virement",
  cheque: "Chèque",
};

export const DOSSIER_FIELDS = [
  "cipCode",
  "siret",
  "ownerName",
  "pharmacyName",
  "address",
  "postalCode",
  "city",
  "phone",
  "email",
  "groupementType",
  "groupementName",
  "paymentMethod",
  "iban",
  "quadraProspectRef",
  "comments",
] as const;
export type DossierField = (typeof DOSSIER_FIELDS)[number];

export type DossierData = Record<DossierField, string>;

export const FIELD_LABELS: Record<DossierField, string> = {
  cipCode: "Code CIP",
  siret: "SIRET",
  ownerName: "Nom du titulaire",
  pharmacyName: "Nom de la pharmacie",
  address: "Adresse",
  postalCode: "Code postal",
  city: "Ville",
  phone: "Téléphone",
  email: "E-mail",
  groupementType: "Groupement",
  groupementName: "Nom du groupement",
  paymentMethod: "Mode de règlement",
  iban: "IBAN",
  quadraProspectRef: "Référence prospect / client Quadra",
  comments: "Commentaires",
};

const MAX_LENGTHS: Record<DossierField, number> = {
  cipCode: 20,
  siret: 20,
  ownerName: 120,
  pharmacyName: 160,
  address: 240,
  postalCode: 10,
  city: 120,
  phone: 25,
  email: 160,
  groupementType: 20,
  groupementName: 120,
  paymentMethod: 20,
  iban: 42,
  quadraProspectRef: 40,
  comments: 2000,
};

/** Champs obligatoires à la transmission (provisoire, cf. HANDOFF.md). */
export const REQUIRED_FOR_SUBMISSION: readonly DossierField[] = [
  "cipCode",
  "siret",
  "ownerName",
  "pharmacyName",
  "address",
  "postalCode",
  "city",
  "phone",
  "groupementType",
  "paymentMethod",
];

export function isRequiredField(field: DossierField, data?: Partial<DossierData>): boolean {
  if (field === "groupementName") return data?.groupementType === "groupement";
  return REQUIRED_FOR_SUBMISSION.includes(field);
}

export function emptyDossierData(): DossierData {
  return Object.fromEntries(DOSSIER_FIELDS.map((f) => [f, ""])) as DossierData;
}

/**
 * Schéma d'enregistrement d'un brouillon : tout est facultatif, seules les longueurs
 * et les valeurs de listes fermées sont contrôlées. Un brouillon peut être incomplet
 * ou contenir un format encore erroné.
 */
const fieldShape = Object.fromEntries(
  DOSSIER_FIELDS.map((f) => {
    if (f === "groupementType") {
      return [f, z.union([z.enum(GROUPEMENT_TYPES), z.literal("")]).optional()];
    }
    if (f === "paymentMethod") {
      return [f, z.union([z.enum(PAYMENT_METHODS), z.literal("")]).optional()];
    }
    return [
      f,
      z
        .string()
        .trim()
        .max(MAX_LENGTHS[f], `${FIELD_LABELS[f]} : ${MAX_LENGTHS[f]} caractères maximum`)
        .optional(),
    ];
  }),
) as Record<DossierField, z.ZodOptional<z.ZodType<string>>>;

export const draftPatchSchema = z.object(fieldShape).strict();
export type DraftPatch = z.infer<typeof draftPatchSchema>;

export type FieldIssue = { field: DossierField; message: string };

/** Erreurs de format sur les champs renseignés (n'exige pas la présence). */
export function formatIssues(data: Partial<DossierData>): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const v = (f: DossierField) => (data[f] ?? "").trim();
  if (v("siret") && !isValidSiret(v("siret")))
    issues.push({ field: "siret", message: "SIRET invalide : 14 chiffres attendus, clé de contrôle incorrecte." });
  if (v("cipCode") && !isValidCip(v("cipCode")))
    issues.push({ field: "cipCode", message: "Code CIP : 7 chiffres attendus." });
  if (v("postalCode") && !isValidPostalCode(v("postalCode")))
    issues.push({ field: "postalCode", message: "Code postal : 5 chiffres attendus." });
  if (v("phone") && !isValidPhone(v("phone")))
    issues.push({ field: "phone", message: "Numéro de téléphone français à 10 chiffres attendu." });
  if (v("email") && !isValidEmail(v("email")))
    issues.push({ field: "email", message: "Adresse e-mail invalide." });
  if (v("iban") && !isValidIban(v("iban")))
    issues.push({ field: "iban", message: "IBAN invalide (structure ou clé de contrôle)." });
  return issues;
}

export function missingFields(data: Partial<DossierData>): DossierField[] {
  return DOSSIER_FIELDS.filter((f) => isRequiredField(f, data) && !(data[f] ?? "").trim());
}

export type DocumentCounts = { KBIS: number; RIB: number };

export type SubmissionCheck = {
  ok: boolean;
  missing: DossierField[];
  invalid: FieldIssue[];
  missingDocuments: ("KBIS" | "RIB")[];
};

/** Contrôle exigé avant transmission à l'ADV (exécuté côté serveur, affiché côté client). */
export function checkSubmission(data: Partial<DossierData>, docs: DocumentCounts): SubmissionCheck {
  const missing = missingFields(data);
  const invalid = formatIssues(data);
  const missingDocuments: ("KBIS" | "RIB")[] = [];
  if (docs.KBIS < 1) missingDocuments.push("KBIS");
  if (docs.RIB < 1) missingDocuments.push("RIB");
  return {
    ok: missing.length === 0 && invalid.length === 0 && missingDocuments.length === 0,
    missing,
    invalid,
    missingDocuments,
  };
}

/**
 * Identifiant client proposé à partir du titulaire et du code postal.
 * RÈGLE PROVISOIRE — la normalisation exacte attendue par Quadra reste à confirmer.
 * Il s'agit d'une simple suggestion affichée à l'ADV, jamais d'une attribution.
 */
export function proposeQuadraIdentifier(ownerName: string, postalCode: string): string | null {
  const name = ownerName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const cp = postalCode.trim();
  if (!name || !/^\d{5}$/.test(cp)) return null;
  return `${name}${cp}`;
}
