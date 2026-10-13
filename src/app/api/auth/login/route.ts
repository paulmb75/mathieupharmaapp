import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate } from "@/server/auth/login";
import { createSession } from "@/server/auth/sessions";
import { setSessionCookie } from "@/server/auth/current";
import { DomainError } from "@/server/errors";
import { readJson, route } from "@/server/http";

const schema = z.object({
  email: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(200),
});

export const POST = route("auth.login", async (req) => {
  const parsed = schema.safeParse(await readJson(req, 4096));
  if (!parsed.success) throw new DomainError("INVALID", "Renseignez votre adresse e-mail et votre mot de passe.");
  const { userId } = await authenticate(parsed.data.email, parsed.data.password);
  const { token } = await createSession(userId);
  await setSessionCookie(token, new Date(Date.now() + 30 * 24 * 3600 * 1000));
  return NextResponse.json({ ok: true });
});
