import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current";
import { changeOwnPassword } from "@/server/services/users";
import { readJson, route } from "@/server/http";

export const POST = route("profile.password", async (req) => {
  const user = await requireApiUser();
  await changeOwnPassword(user, await readJson(req, 4096));
  return NextResponse.json({ ok: true });
});
