export const ROLES = ["commercial", "adv", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  commercial: "Commercial",
  adv: "Administration des ventes (ADV)",
  admin: "Administrateur",
};

export const ROLE_SHORT_LABELS: Record<Role, string> = {
  commercial: "Commercial",
  adv: "ADV",
  admin: "Admin",
};

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
