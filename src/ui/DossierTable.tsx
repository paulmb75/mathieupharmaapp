"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, formatRelative } from "@/domain/dates";
import { formatSiret } from "@/domain/formats";
import type { DossierStatus } from "@/domain/status";
import { StatusBadge } from "./Badge";

export type DossierRowData = {
  id: string;
  reference: string;
  status: DossierStatus;
  pharmacyName: string | null;
  city: string | null;
  postalCode: string | null;
  siret: string | null;
  ownerName: string;
  submittedAt: Date | null;
  updatedAt: Date;
  documentCount: number;
};

/** Vue tableau pour ordinateur (ADV, direction). Ligne entière cliquable + lien accessible. */
export function DossierTable({ rows, showOwner = true }: { rows: DossierRowData[]; showOwner?: boolean }) {
  const router = useRouter();
  return (
    <div className="mp-table-wrap">
      <table className="mp-table">
        <thead>
          <tr>
            <th scope="col">Pharmacie</th>
            <th scope="col">SIRET</th>
            {showOwner && <th scope="col">Commercial</th>}
            <th scope="col">Statut</th>
            <th scope="col">Transmis le</th>
            <th scope="col">Mis à jour</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => router.push(`/dossiers/${r.id}`)}>
              <td>
                <div className="mp-table__primary">
                  <Link href={`/dossiers/${r.id}`} onClick={(e) => e.stopPropagation()}>
                    {r.pharmacyName || "Pharmacie sans nom"}
                  </Link>
                </div>
                <div className="mp-table__sub">
                  {[r.postalCode, r.city].filter(Boolean).join(" ") || "—"} · {r.reference}
                </div>
              </td>
              <td className="mp-mono">{r.siret ? formatSiret(r.siret) : "—"}</td>
              {showOwner && <td>{r.ownerName}</td>}
              <td>
                <StatusBadge status={r.status} size="sm" />
              </td>
              <td>{r.submittedAt ? formatDate(r.submittedAt) : "—"}</td>
              <td className="mp-table__sub">{formatRelative(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
