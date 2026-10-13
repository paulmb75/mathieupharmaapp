import type { Metadata } from "next";
import { BadgeCheck, Building2, Clock, Inbox, SearchX } from "lucide-react";
import { STATUSES, type DossierStatus } from "@/domain/status";
import { requirePageUser } from "@/server/auth/current";
import { countByStatus, listDossiers, weekStats } from "@/server/services/dossiers";
import { DossierCard } from "@/ui/DossierCard";
import { DossierTable } from "@/ui/DossierTable";
import { EmptyState, PageHeader } from "@/ui/PageHeader";
import { SearchBox } from "@/ui/client/SearchBox";
import { activeChipKey, StatusChips, type ChipDef } from "@/ui/StatusChips";

export const metadata: Metadata = { title: "À traiter" };

const QUEUE_CHIPS: ChipDef[] = [
  { key: "submitted", label: "À vérifier", statuses: ["SUBMITTED"] },
  { key: "validated", label: "À créer dans Quadra", statuses: ["VALIDATED"] },
  { key: "needs", label: "En attente du commercial", statuses: ["NEEDS_INFO"] },
];

export default async function AdvQueuePage({ searchParams }: PageProps<"/adv">) {
  const user = await requirePageUser(["adv"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const raw = Array.isArray(sp.statut) ? sp.statut : sp.statut ? [sp.statut] : [];
  let statuses = raw.filter((s): s is DossierStatus => (STATUSES as readonly string[]).includes(s));
  if (!statuses.length) statuses = ["SUBMITTED"];
  const [items, counts, week] = await Promise.all([
    listDossiers(user, { q, statuses, order: "queue" }),
    countByStatus(user),
    weekStats(user),
  ]);

  const stats = [
    { icon: Inbox, value: counts.SUBMITTED, label: "À vérifier" },
    { icon: BadgeCheck, value: counts.VALIDATED, label: "À créer dans Quadra" },
    { icon: Clock, value: counts.NEEDS_INFO, label: "En attente commercial" },
    { icon: Building2, value: week.created, label: "Créés cette semaine" },
  ];

  return (
    <div className="mp-content">
      <PageHeader title="Dossiers à traiter" subtitle="Vérification des demandes et suivi des créations Quadra" />
      <div className="mp-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 20 }}>
        {stats.map((s) => (
          <div key={s.label} className="mp-stat">
            <s.icon aria-hidden />
            <div>
              <div className="mp-stat__value">{s.value}</div>
              <div className="mp-stat__label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mp-stack mp-stack--lg">
        <SearchBox placeholder="Pharmacie, ville, SIRET, commercial, référence" />
        <StatusChips basePath="/adv" chips={QUEUE_CHIPS} activeKey={activeChipKey(QUEUE_CHIPS, statuses)} q={q} counts={counts} />
        {items.length === 0 ? (
          <EmptyState icon={<SearchX aria-hidden />} title="Rien à traiter ici">
            {q ? "Aucun dossier ne correspond à la recherche." : "Aucun dossier dans cette file."}
          </EmptyState>
        ) : (
          <>
            <p className="mp-xsmall mp-muted">Les plus anciennes transmissions apparaissent en premier.</p>
            <div className="mp-dlist mp-only-mobile">
              {items.map((d) => (
                <DossierCard key={d.id} d={d} />
              ))}
            </div>
            <div className="mp-only-desktop">
              <DossierTable rows={items} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
