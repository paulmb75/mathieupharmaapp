import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current";
import { updateUser } from "@/server/services/users";
import { readJson, route } from "@/server/http";

export const PATCH = route<{ id: string }>("admin.users.update", async (req, { id }) => {
  const user = await requireApiUser(["admin"]);
  await updateUser(user, id, await readJson(req));
  return NextResponse.json({ ok: true });
});
