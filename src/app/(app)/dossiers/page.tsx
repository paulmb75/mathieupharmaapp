import type { Metadata } from "next";
import { Plus, SearchX } from "lucide-react";
import { STATUSES, type DossierStatus } from "@/domain/status";
import { requirePageUser } from "@/server/auth/current";
import { countByStatus, listDossiers } from "@/server/services/dossiers";
import { ButtonLink } from "@/ui/Button";
import { DossierCard } from "@/ui/DossierCard";
import { DossierTable } from "@/ui/DossierTable";
import { EmptyState, PageHeader } from "@/ui/PageHeader";
import { SearchBox } from "@/ui/client/SearchBox";
import { activeChipKey, StatusChips, type ChipDef } from "@/ui/StatusChips";

export const metadata: Metadata = { title: "Dossiers" };

const COMMERCIAL_CHIPS: ChipDef[] = [
  { key: "all", label: "Tous", statuses: [] },
  { key: "draft", label: "Brouillons", statuses: ["DRAFT"] },
  { key: "needs", label: "À compléter", statuses: ["NEEDS_INFO"] },
  { key: "pending", label: "En validation", statuses: ["SUBMITTED", "VALIDATED"] },
  { key: "created", label: "Créés", statuses: ["CREATED_IN_QUADRA"] },
  { key: "rejected", label: "Refusés", statuses: ["REJECTED"] },
];

const ADV_CHIPS: ChipDef[] = [
  { key: "all", label: "Tous", statuses: [] },
  { key: "submitted", label: "Soumis à l’ADV", statuses: ["SUBMITTED"] },
  { key: "needs", label: "À compléter", statuses: ["NEEDS_INFO"] },
  { key: "validated", label: "Validés", statuses: ["VALIDATED"] },
  { key: "created", label: "Créés dans Quadra", statuses: ["CREATED_IN_QUADRA"] },
  { key: "rejected", label: "Refusés", statuses: ["REJECTED"] },
];

function parseStatuses(v: string | string[] | undefined): DossierStatus[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr.filter((s): s is DossierStatus => (STATUSES as readonly string[]).includes(s));
}

export default async function DossiersPage({ searchParams }: PageProps<"/dossiers">) {
  const user = await requirePageUser(["commercial", "adv"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const statuses = parseStatuses(sp.statut);
  const chips = user.role === "adv" ? ADV_CHIPS : COMMERCIAL_CHIPS;
  const [items, counts] = await Promise.all([listDossiers(user, { q, statuses }), countByStatus(user)]);
  const isAdv = user.role === "adv";

  return (
    <div className="mp-content">
      <PageHeader
        title={isAdv ? "Demandes d’ouverture" : "Ouvertures de compte"}
        subtitle={isAdv ? "Toutes les demandes transmises par les commerciaux" : "Suivez vos demandes clients"}
      />
      <div className="mp-stack mp-stack--lg">
        <SearchBox placeholder="Pharmacie, ville ou SIRET" />
        {!isAdv && (
          <ButtonLink href="/dossiers/nouveau" block icon={<Plus aria-hidden />} className="mp-only-mobile">
            Nouvelle ouverture
          </ButtonLink>
        )}
        <StatusChips basePath="/dossiers" chips={chips} activeKey={activeChipKey(chips, statuses)} q={q} counts={counts} />

        {items.length === 0 ? (
          <EmptyState icon={<SearchX aria-hidden />} title={q || statuses.length ? "Aucun dossier ne correspond" : "Aucun dossier"}>
            {q || statuses.length ? "Modifiez la recherche ou le filtre." : isAdv ? "Aucune demande transmise pour l’instant." : "Créez votre première demande d’ouverture."}
          </EmptyState>
        ) : (
          <>
            <div className="mp-dlist mp-only-mobile">
              {items.map((d) => (
                <DossierCard key={d.id} d={d} showOwner={isAdv} />
              ))}
            </div>
            <div className="mp-only-desktop">
              <DossierTable rows={items} showOwner={isAdv} />
            </div>
            <p className="mp-xsmall mp-muted">
              {items.length} dossier{items.length > 1 ? "s" : ""} affiché{items.length > 1 ? "s" : ""}
              {items.length >= 100 ? " (100 premiers — affinez la recherche)" : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
