import { describe, expect, it } from "vitest";
import { availableActions, canTransition, STATUSES, TRANSITIONS, TRANSITION_ACTIONS } from "@/domain/status";

const owner = { id: "owner", role: "commercial" as const };
const other = { id: "other", role: "commercial" as const };
const adv = { id: "adv", role: "adv" as const };
const admin = { id: "admin", role: "admin" as const };

describe("table des transitions", () => {
  it("seul le commercial propriétaire transmet un brouillon ou un dossier à compléter", () => {
    expect(canTransition("submit", "DRAFT", owner, "owner")).toBe(true);
    expect(canTransition("submit", "NEEDS_INFO", owner, "owner")).toBe(true);
    expect(canTransition("submit", "DRAFT", other, "owner")).toBe(false);
    expect(canTransition("submit", "DRAFT", adv, "owner")).toBe(false);
    expect(canTransition("submit", "SUBMITTED", owner, "owner")).toBe(false);
  });

  it("la création Quadra exige une validation préalable", () => {
    expect(canTransition("confirm_quadra", "SUBMITTED", adv, "owner")).toBe(false);
    expect(canTransition("confirm_quadra", "VALIDATED", adv, "owner")).toBe(true);
    expect(TRANSITIONS.validate.to).not.toBe("CREATED_IN_QUADRA");
  });

  it("aucune transition depuis les statuts finaux, aucune pour l'administrateur", () => {
    for (const s of ["CREATED_IN_QUADRA", "REJECTED"] as const) {
      expect(availableActions(s, adv, "owner")).toEqual([]);
      expect(availableActions(s, owner, "owner")).toEqual([]);
    }
    for (const s of STATUSES) expect(availableActions(s, admin, "owner")).toEqual([]);
  });

  it("chaque action a un rôle unique et un statut cible distinct de ses statuts d'origine", () => {
    for (const a of TRANSITION_ACTIONS) {
      expect(TRANSITIONS[a].from).not.toContain(TRANSITIONS[a].to);
    }
  });
});
