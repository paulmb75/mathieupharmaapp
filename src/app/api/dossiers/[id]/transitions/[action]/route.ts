import { NextResponse } from "next/server";
import { TRANSITION_ACTIONS, type TransitionAction } from "@/domain/status";
import { requireApiUser } from "@/server/auth/current";
import { applyTransition } from "@/server/services/dossiers";
import { DomainError } from "@/server/errors";
import { readJson, route } from "@/server/http";

type Params = { id: string; action: string };

export const POST = route<Params>("dossiers.transition", async (req, { id, action }) => {
  const user = await requireApiUser(["commercial", "adv"]);
  if (!(TRANSITION_ACTIONS as readonly string[]).includes(action)) {
    throw new DomainError("NOT_FOUND", "Action inconnue.");
  }
  const result = await applyTransition(user, id, action as TransitionAction, await readJson(req));
  return NextResponse.json(result);
});
