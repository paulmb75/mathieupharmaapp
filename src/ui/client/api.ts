"use client";

export type ApiError = { code: string; message: string; details?: unknown; status: number; network?: boolean };

export class ApiRequestError extends Error {
  constructor(public readonly error: ApiError) {
    super(error.message);
  }
}

/** Appel JSON vers l'API interne. Distingue les erreurs réseau des refus serveur. */
export async function apiFetch<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiRequestError({
      code: "NETWORK",
      message: "Connexion impossible. Vérifiez votre réseau puis réessayez.",
      status: 0,
      network: true,
    });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error ?? {};
    if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/")) {
      // Session expirée : rechargement complet vers la connexion.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/connexion";
    }
    throw new ApiRequestError({
      code: err.code ?? "HTTP_" + res.status,
      message: err.message ?? "Une erreur est survenue.",
      details: err.details,
      status: res.status,
    });
  }
  return body as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.error.message;
  return "Une erreur inattendue est survenue.";
}

/** Identifiant aléatoire utilisable même hors contexte sécurisé (HTTP en réseau local). */
export function randomKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
