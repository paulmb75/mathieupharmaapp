import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth/current";
import { createUser, listUsers } from "@/server/services/users";
import { readJson, route } from "@/server/http";

export const GET = route("admin.users.list", async () => {
  const user = await requireApiUser(["admin"]);
  return NextResponse.json({ items: await listUsers(user) });
});

export const POST = route("admin.users.create", async (req) => {
  const user = await requireApiUser(["admin"]);
  return NextResponse.json(await createUser(user, await readJson(req)), { status: 201 });
});
