import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current";
import { deleteDraft, getDossierDetail, saveDraft } from "@/server/services/dossiers";
import { getStorage } from "@/server/storage";
import { logError } from "@/server/errors";
import { readJson, route } from "@/server/http";

type Params = { id: string };

export const GET = route<Params>("dossiers.get", async (_req, { id }) => {
  const user = await requireApiUser();
  return NextResponse.json(await getDossierDetail(user, id));
});

export const PATCH = route<Params>("dossiers.save", async (req, { id }) => {
  const user = await requireApiUser(["commercial"]);
  return NextResponse.json(await saveDraft(user, id, await readJson(req)));
});

export const DELETE = route<Params>("dossiers.delete", async (_req, { id }) => {
  const user = await requireApiUser(["commercial"]);
  const { storageKeys } = await deleteDraft(user, id);
  const storage = getStorage();
  await Promise.all(storageKeys.map((k) => storage.delete(k).catch((e) => logError("dossiers.delete.file", e))));
  return NextResponse.json({ ok: true });
});
