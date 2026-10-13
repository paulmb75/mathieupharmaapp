import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { requirePageUser } from "@/server/auth/current";
import { listActivity } from "@/server/services/dossiers";
import { EmptyState, PageHeader } from "@/ui/PageHeader";
import { Timeline } from "@/ui/Timeline";

export const metadata: Metadata = { title: "Activité" };

export default async function ActivityPage() {
  const user = await requirePageUser(["commercial", "adv"]);
  const items = await listActivity(user, 60);
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const key = it.dossierId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  return (
    <div className="mp-content mp-content--narrow">
      <PageHeader title="Activité" subtitle={user.role === "adv" ? "Derniers événements sur les dossiers transmis" : "Derniers événements sur vos dossiers"} />
      {items.length === 0 ? (
        <EmptyState icon={<Activity aria-hidden />} title="Aucune activité récente" />
      ) : (
        <div className="mp-stack mp-stack--lg">
          {[...groups.values()].map((events) => (
            <section key={events[0]!.dossierId} className="mp-card mp-card--padded mp-stack">
              <Link href={`/dossiers/${events[0]!.dossierId}`} className="mp-row mp-row--between">
                <span className="mp-section-title">{events[0]!.pharmacyName || "Pharmacie sans nom"}</span>
                <span className="mp-xsmall mp-muted">{events[0]!.reference}</span>
              </Link>
              <Timeline events={events} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
