import { NextResponse } from "next/server";
import { MAX_FILE_BYTES } from "@/domain/documents";
import { requireApiUser } from "@/server/auth/current";
import { addDocument } from "@/server/services/documents";
import { DomainError } from "@/server/errors";
import { route } from "@/server/http";

export const POST = route<{ id: string }>("documents.upload", async (req, { id }) => {
  const user = await requireApiUser(["commercial"]);
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_FILE_BYTES + 64 * 1024) {
    throw new DomainError("INVALID", `Fichier trop volumineux (${MAX_FILE_BYTES / 1024 / 1024} Mo maximum).`);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new DomainError("INVALID", "Envoi du fichier invalide.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new DomainError("INVALID", "Aucun fichier reçu.");
  if (file.size > MAX_FILE_BYTES) {
    throw new DomainError("INVALID", `Fichier trop volumineux (${MAX_FILE_BYTES / 1024 / 1024} Mo maximum).`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await addDocument(user, id, form.get("kind"), { name: file.name, bytes });
  return NextResponse.json(result, { status: 201 });
});
