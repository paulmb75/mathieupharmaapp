export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const HTTP_STATUS: Record<DomainErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID: 422,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
};

/** Masque tout ce qui ressemble à un IBAN ou à un mot de passe avant journalisation. */
export function scrub(text: string): string {
  return text
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/gi, "[IBAN masqué]")
    .replace(/("?password"?\s*[:=]\s*)"[^"]*"/gi, '$1"[masqué]"');
}

/** Journalisation d'erreur sans corps de requête ni paramètres SQL. */
export function logError(context: string, err: unknown): void {
  if (err instanceof DomainError) return;
  const e = err as { name?: string; code?: string; message?: string };
  console.error(`[${context}]`, e?.name ?? "Error", e?.code ?? "", scrub(String(e?.message ?? err)));
}
