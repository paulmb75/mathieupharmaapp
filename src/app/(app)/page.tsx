import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Camera,
  Car,
  ChevronRight,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  PackageOpen,
  Send,
  UserPlus,
} from "lucide-react";
import { firstNameOf } from "@/domain/roles";
import { requirePageUser } from "@/server/auth/current";
import { countByStatus, listDossiers, weekStats } from "@/server/services/dossiers";
import { SoonTag } from "@/ui/Badge";
import { Callout } from "@/ui/Callout";
import { DossierCard } from "@/ui/DossierCard";
import { EmptyState, SectionHead } from "@/ui/PageHeader";

export const metadata: Metadata = { title: "Accueil" };

export default async function HomePage() {
  const user = await requirePageUser();
  if (user.role === "adv") redirect("/adv");
  if (user.role === "admin") redirect("/admin");

  const [counts, stats, inValidation, recent] = await Promise.all([
    countByStatus(user),
    weekStats(user),
    listDossiers(user, { statuses: ["SUBMITTED", "VALIDATED"], limit: 3 }),
    listDossiers(user, { limit: 4 }),
  ]);
  const toComplete = counts.NEEDS_INFO;

  return (
    <div className="mp-content">
      <header style={{ margin: "4px 0 20px" }}>
        <h1 className="mp-page-title">Bonjour {firstNameOf(user.fullName)}</h1>
        <p className="mp-page-subtitle">Votre journée, en un coup d’œil</p>
      </header>

      <section aria-labelledby="week-title">
        <SectionHead title={<span id="week-title">Cette semaine</span>} />
        <div className="mp-stats">
          <div className="mp-stat">
            <Send aria-hidden />
            <div>
              <div className="mp-stat__value">{stats.submitted}</div>
              <div className="mp-stat__label">{stats.submitted > 1 ? "Demandes transmises" : "Demande transmise"}</div>
            </div>
          </div>
          <div className="mp-stat">
            <FileCheck2 aria-hidden />
            <div>
              <div className="mp-stat__value">{stats.created}</div>
              <div className="mp-stat__label">{stats.created > 1 ? "Comptes créés" : "Compte créé"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mp-section" aria-label="Actions">
        <div className="mp-tiles">
          <Link href="/dossiers/nouveau" className="mp-tile mp-tile--primary">
            <div className="mp-tile__top">
              <UserPlus className="mp-tile__icon" aria-hidden />
              <ChevronRight className="mp-tile__chevron" aria-hidden />
            </div>
            <span className="mp-tile__label">Ouvrir un compte</span>
          </Link>
          <div className="mp-tile mp-tile--disabled" aria-disabled="true">
            <div className="mp-tile__top">
              <Camera className="mp-tile__icon" aria-hidden />
              <SoonTag />
            </div>
            <div>
              <span className="mp-tile__label">Rapport du jour</span>
              <p className="mp-tile__sub">Photographier mon rapport</p>
            </div>
          </div>
          <div className="mp-tile mp-tile--disabled" aria-disabled="true">
            <div className="mp-tile__top">
              <Car className="mp-tile__icon" aria-hidden />
              <SoonTag />
            </div>
            <span className="mp-tile__label">Mon véhicule</span>
          </div>
          <div className="mp-tile mp-tile--disabled" aria-disabled="true">
            <div className="mp-tile__top">
              <PackageOpen className="mp-tile__icon" aria-hidden />
              <SoonTag />
            </div>
            <span className="mp-tile__label">Retour produit</span>
          </div>
        </div>
      </section>

      {toComplete > 0 && (
        <section className="mp-section">
          <Callout
            tone="warning"
            href="/dossiers?statut=NEEDS_INFO"
            title={toComplete > 1 ? `${toComplete} dossiers à compléter` : "1 dossier à compléter"}
          >
            L’ADV attend une pièce ou une correction.
          </Callout>
        </section>
      )}

      <section className="mp-section">
        <SectionHead
          title="En cours de validation"
          action={
            counts.SUBMITTED + counts.VALIDATED > 0 ? (
              <Link className="mp-section-link" href="/dossiers?statut=SUBMITTED&statut=VALIDATED">
                Tout voir
              </Link>
            ) : undefined
          }
        />
        {inValidation.length ? (
          <div className="mp-dlist">
            {inValidation.map((d) => (
              <DossierCard key={d.id} d={d} showOwner={false} />
            ))}
          </div>
        ) : (
          <EmptyState title="Aucune demande en validation">Les dossiers transmis à l’ADV apparaîtront ici.</EmptyState>
        )}
      </section>

      <section className="mp-section">
        <SectionHead
          title="Dossiers récents"
          action={
            <Link className="mp-section-link" href="/dossiers">
              Tous les dossiers
            </Link>
          }
        />
        {recent.length ? (
          <div className="mp-dlist">
            {recent.map((d) => (
              <DossierCard key={d.id} d={d} showOwner={false} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<FolderOpen aria-hidden />} title="Aucun dossier pour le moment">
            Touchez « Ouvrir un compte » pour créer votre première demande.
          </EmptyState>
        )}
      </section>

      <section className="mp-section">
        <SectionHead title="Accès rapides" />
        <div className="mp-linklist">
          <div className="mp-linklist__row mp-linklist__row--disabled" aria-disabled="true">
            <GraduationCap aria-hidden />
            <span className="mp-linklist__label">Formations</span>
            <SoonTag />
          </div>
          <div className="mp-linklist__row mp-linklist__row--disabled" aria-disabled="true">
            <FolderOpen aria-hidden />
            <span className="mp-linklist__label">Mon fichier DN</span>
            <SoonTag />
          </div>
        </div>
      </section>
    </div>
  );
}
