export const DOCUMENT_KINDS = ["KBIS", "RIB"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  KBIS: "KBIS de la pharmacie",
  RIB: "RIB de la pharmacie",
};

export const DOCUMENT_HINTS: Record<DocumentKind, string> = {
  KBIS: "Extrait de moins de 3 mois. Ajoutez toutes les pages.",
  RIB: "RIB au nom de la pharmacie ou de son titulaire.",
};

/** Taille maximale d'un fichier (une page ou un PDF complet). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Nombre maximal de fichiers (pages) par type de justificatif. */
export const MAX_FILES_PER_KIND = 10;

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

/** Valeur de l'attribut `accept` des champs fichier. */
export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Les navigateurs de bureau n'affichent pas le HEIC : téléchargement uniquement. */
export function isPreviewable(mime: string): boolean {
  return mime !== "image/heic";
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}
