"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, Folder, House, Inbox, Plus, User, Users } from "lucide-react";
import type { Role } from "@/domain/roles";
import { Logo } from "../Logo";
import { isFocusPath, navFor, type NavIcon } from "./nav";

const ICONS: Record<NavIcon, typeof House> = {
  home: House,
  inbox: Inbox,
  folder: Folder,
  activity: Activity,
  user: User,
  users: Users,
};

type Props = {
  role: Role;
  fullName: string;
  initials: string;
  roleLabel: string;
  needsInfoCount: number;
};

export function Sidebar({ role, fullName, initials, roleLabel, needsInfoCount }: Props) {
  const path = usePathname();
  return (
    <aside className="mp-sidebar" aria-label="Navigation principale">
      <Link href="/" className="mp-sidebar__logo" aria-label="Accueil">
        <Logo height={46} />
      </Link>
      {role === "commercial" && (
        <Link href="/dossiers/nouveau" className="mp-btn mp-btn--primary mp-btn--block">
          <Plus aria-hidden /> Nouvelle ouverture
        </Link>
      )}
      <nav className="mp-sidebar__nav">
        {navFor(role).map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.match(path);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mp-navlink${active ? " mp-navlink--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden />
              {item.label}
              {item.badge === "needsInfo" && needsInfoCount > 0 && (
                <span className="mp-navlink__count" aria-label={`${needsInfoCount} à compléter`}>
                  {needsInfoCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <Link href="/profil" className="mp-sidebar__user">
        <span className="mp-avatar" aria-hidden>
          {initials}
        </span>
        <span>
          <span className="mp-sidebar__user-name" style={{ display: "block" }}>
            {fullName}
          </span>
          <span className="mp-sidebar__user-role">{roleLabel}</span>
        </span>
      </Link>
    </aside>
  );
}

export function MobileTopbar({ initials, needsInfoCount, role }: { initials: string; needsInfoCount: number; role: Role }) {
  const path = usePathname();
  if (isFocusPath(path)) return null;
  const alertHref = role === "commercial" ? "/dossiers?statut=NEEDS_INFO" : role === "adv" ? "/adv" : "/admin";
  return (
    <header className="mp-topbar mp-topbar--app">
      <Link href="/" aria-label="Accueil">
        <Logo height={44} />
      </Link>
      <div className="mp-topbar__actions">
        {role !== "admin" && (
          <Link
            href={alertHref}
            className="mp-iconbtn"
            aria-label={needsInfoCount > 0 ? `${needsInfoCount} dossier(s) demandent votre attention` : "Aucune alerte"}
          >
            <Bell aria-hidden />
            {needsInfoCount > 0 && <span className="mp-iconbtn__dot" />}
          </Link>
        )}
        <Link href="/profil" className="mp-avatar" aria-label="Mon profil">
          {initials}
        </Link>
      </div>
    </header>
  );
}

export function BottomNav({ role, needsInfoCount }: { role: Role; needsInfoCount: number }) {
  const path = usePathname();
  if (isFocusPath(path)) return null;
  const items = navFor(role);
  return (
    <nav className="mp-bottomnav" aria-label="Navigation" style={{ ["--mp-nav-count" as string]: items.length }}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.match(path);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mp-bottomnav__item${active ? " mp-bottomnav__item--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden />
            {item.label}
            {item.badge === "needsInfo" && needsInfoCount > 0 && <span className="mp-nav-dot">{needsInfoCount}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function MainArea({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <main className={`mp-main${isFocusPath(path) ? " mp-main--focus" : ""}`}>{children}</main>;
}
