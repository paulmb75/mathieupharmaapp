import { NextResponse } from "next/server";
import { STATUSES } from "@/domain/status";
import { requireApiUser } from "@/server/auth/current";
import { createDraft, listDossiers } from "@/server/services/dossiers";
import { readJson, route } from "@/server/http";

export const GET = route("dossiers.list", async (req) => {
  const user = await requireApiUser();
  const sp = req.nextUrl.searchParams;
  const statuses = sp.getAll("statut").filter((s): s is (typeof STATUSES)[number] => (STATUSES as readonly string[]).includes(s));
  const items = await listDossiers(user, { q: sp.get("q") ?? undefined, statuses });
  return NextResponse.json({ items });
});

export const POST = route("dossiers.create", async (req) => {
  const user = await requireApiUser(["commercial"]);
  const result = await createDraft(user, await readJson(req));
  return NextResponse.json(result, { status: result.created ? 201 : 200 });
});
