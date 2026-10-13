import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie } from "@/server/auth/current";
import { invalidateSession, SESSION_COOKIE } from "@/server/auth/sessions";
import { route } from "@/server/http";

export const POST = route("auth.logout", async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
