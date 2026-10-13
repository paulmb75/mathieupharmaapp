import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { DomainError, HTTP_STATUS, logError } from "./errors";

/**
 * Protection CSRF des routes de mutation : la requête doit provenir de la même origine
 * (en complément du cookie de session SameSite=Lax).
 */
export function assertSameOrigin(req: NextRequest): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost && originHost === host) return;
    throw new DomainError("FORBIDDEN", "Origine de la requête refusée.");
  }
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return;
  throw new DomainError("FORBIDDEN", "Origine de la requête refusée.");
}

export async function readJson(req: NextRequest, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new DomainError("INVALID", "Requête trop volumineuse.");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("INVALID", "Corps de requête invalide.");
  }
}

export function errorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      { status: HTTP_STATUS[err.code] },
    );
  }
  logError(context, err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Une erreur inattendue est survenue. Réessayez." } },
    { status: 500 },
  );
}

type Handler<P> = (req: NextRequest, params: P) => Promise<Response>;

/** Enveloppe commune : contrôle d'origine, gestion d'erreurs, pas de cache. */
export function route<P = Record<string, never>>(context: string, handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      assertSameOrigin(req);
      const res = await handler(req, await ctx.params);
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    } catch (err) {
      return errorResponse(err, context);
    }
  };
}
