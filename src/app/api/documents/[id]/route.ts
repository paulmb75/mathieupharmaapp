import { NextResponse } from "next/server";
import { isPreviewable } from "@/domain/documents";
import { requireApiUser } from "@/server/auth/current";
import { readDocument, removeDocument } from "@/server/services/documents";
import { route } from "@/server/http";

type Params = { id: string };

/** Accès contrôlé à un justificatif : jamais servi statiquement, jamais mis en cache. */
export const GET = route<Params>("documents.read", async (req, { id }) => {
  const user = await requireApiUser(["commercial", "adv"]);
  const { bytes, mimeType, originalName } = await readDocument(user, id);
  const download = req.nextUrl.searchParams.get("telecharger") === "1" || !isPreviewable(mimeType);
  const encoded = encodeURIComponent(originalName);
  const headers: Record<string, string> = {
    "Content-Type": mimeType,
    "Content-Length": String(bytes.length),
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
    "X-Content-Type-Options": "nosniff",
  };
  if (mimeType.startsWith("image/")) headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; sandbox";
  return new NextResponse(new Uint8Array(bytes), { headers });
});

export const DELETE = route<Params>("documents.remove", async (_req, { id }) => {
  const user = await requireApiUser(["commercial"]);
  await removeDocument(user, id);
  return NextResponse.json({ ok: true });
});
