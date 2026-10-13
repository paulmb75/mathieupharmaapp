import type { Role } from "@/domain/roles";

export type NavIcon = "home" | "inbox" | "folder" | "activity" | "user" | "users";

export type NavItem = { href: string; label: string; icon: NavIcon; match: (path: string) => boolean; badge?: "needsInfo" };

const isDossierPath = (p: string) => p.startsWith("/dossiers");

export function navFor(role: Role): NavItem[] {
  switch (role) {
    case "commercial":
      return [
        { href: "/", label: "Accueil", icon: "home", match: (p) => p === "/" },
        { href: "/dossiers", label: "Dossiers", icon: "folder", match: isDossierPath, badge: "needsInfo" },
        { href: "/activite", label: "Activité", icon: "activity", match: (p) => p.startsWith("/activite") },
        { href: "/profil", label: "Profil", icon: "user", match: (p) => p.startsWith("/profil") },
      ];
    case "adv":
      return [
        { href: "/adv", label: "À traiter", icon: "inbox", match: (p) => p.startsWith("/adv") },
        { href: "/dossiers", label: "Dossiers", icon: "folder", match: isDossierPath },
        { href: "/activite", label: "Activité", icon: "activity", match: (p) => p.startsWith("/activite") },
        { href: "/profil", label: "Profil", icon: "user", match: (p) => p.startsWith("/profil") },
      ];
    case "admin":
      return [
        { href: "/admin", label: "Utilisateurs", icon: "users", match: (p) => p.startsWith("/admin") },
        { href: "/profil", label: "Profil", icon: "user", match: (p) => p.startsWith("/profil") },
      ];
  }
}

/** Écrans « focus » (assistant de saisie) : pas de navigation basse sur mobile. */
export function isFocusPath(path: string): boolean {
  return /^\/dossiers\/(nouveau|[^/]+\/modifier)$/.test(path);
}
