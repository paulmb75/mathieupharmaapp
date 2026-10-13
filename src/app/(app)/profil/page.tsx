import type { Metadata } from "next";
import { initialsOf, ROLE_LABELS } from "@/domain/roles";
import { requirePageUser } from "@/server/auth/current";
import { Callout } from "@/ui/Callout";
import { PageHeader, SectionHead } from "@/ui/PageHeader";
import { ChangePasswordForm, LogoutButton } from "@/ui/client/ProfileForms";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requirePageUser();
  return (
    <div className="mp-content mp-content--narrow">
      <PageHeader title="Profil" />
      <div className="mp-stack mp-stack--lg">
        {user.mustChangePassword && (
          <Callout tone="warning" title="Mot de passe temporaire">
            Choisissez un mot de passe personnel ci-dessous.
          </Callout>
        )}
        <section className="mp-card mp-card--padded mp-row" style={{ gap: 16 }}>
          <span className="mp-avatar" style={{ width: 56, height: 56, fontSize: 18 }} aria-hidden>
            {initialsOf(user.fullName)}
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="mp-section-title" style={{ fontSize: 18 }}>
              {user.fullName}
            </p>
            <p className="mp-small mp-muted" style={{ overflowWrap: "anywhere" }}>
              {user.email}
            </p>
            <p className="mp-small mp-muted">{ROLE_LABELS[user.role]}</p>
          </div>
        </section>
        <section className="mp-card mp-card--padded">
          <SectionHead title="Changer de mot de passe" />
          <ChangePasswordForm />
        </section>
        <LogoutButton />
      </div>
    </div>
  );
}
