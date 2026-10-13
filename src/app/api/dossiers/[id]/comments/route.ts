import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current";
import { addComment } from "@/server/services/dossiers";
import { readJson, route } from "@/server/http";

export const POST = route<{ id: string }>("dossiers.comment", async (req, { id }) => {
  const user = await requireApiUser(["commercial", "adv"]);
  await addComment(user, id, await readJson(req));
  return NextResponse.json({ ok: true }, { status: 201 });
});
