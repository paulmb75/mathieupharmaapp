import Link from "next/link";
import { AlertCircle, BadgeCheck, CheckCircle2, ChevronRight, Clock, FileText, Store, XCircle } from "lucide-react";
import type { DossierStatus } from "@/domain/status";
import { formatDate, formatRelative } from "@/domain/dates";
import { StatusBadge } from "./Badge";

export type DossierCardData = {
  id: string;
  reference: string;
  status: DossierStatus;
  pharmacyName: string | null;
  city: string | null;
  ownerName: string;
  lastAdvMessage: string | null;
  submittedAt: Date | null;
  updatedAt: Date;
};

export function statusHint(d: Pick<DossierCardData, "status" | "lastAdvMessage" | "submittedAt">) {
  switch (d.status) {
    case "DRAFT":
      return { icon: FileText, tone: "info", text: "Brouillon à terminer" } as const;
    case "NEEDS_INFO":
      return { icon: AlertCircle, tone: "warning", text: d.lastAdvMessage || "Complément demandé par l’ADV" } as const;
    case "SUBMITTED":
      return {
        icon: Clock,
        tone: "info",
        text: d.submittedAt ? `Transmis à l’ADV le ${formatDate(d.submittedAt)}` : "Transmis à l’ADV",
      } as const;
    case "VALIDATED":
      return { icon: BadgeCheck, tone: "info", text: "Validé — création Quadra en attente" } as const;
    case "CREATED_IN_QUADRA":
      return { icon: CheckCircle2, tone: "success", text: "Création confirmée" } as const;
    case "REJECTED":
      return { icon: XCircle, tone: "danger", text: d.lastAdvMessage || "Dossier refusé" } as const;
  }
}

export function DossierCard({ d, showOwner = true }: { d: DossierCardData; showOwner?: boolean }) {
  const hint = statusHint(d);
  const HintIcon = hint.icon;
  const editable = d.status === "DRAFT" || d.status === "NEEDS_INFO";
  const href = `/dossiers/${d.id}`;
  return (
    <article className="mp-dcard">
      <span className="mp-icon-circle" aria-hidden>
        <Store />
      </span>
      <div className="mp-dcard__body">
        <div className="mp-dcard__top">
          <div style={{ minWidth: 0 }}>
            <h3 className="mp-dcard__title">
              <Link href={href} className="mp-dcard__link">
                {d.pharmacyName || "Pharmacie sans nom"}
              </Link>
            </h3>
            <p className="mp-dcard__city">{d.city || "Ville non renseignée"}</p>
          </div>
          <StatusBadge status={d.status} />
        </div>
        <div className="mp-dcard__foot">
          <p className="mp-dcard__hint">
            <HintIcon
              className={`mp-hint-icon--${hint.tone}`}
              aria-hidden
              {...(hint.tone === "warning" ? { fill: "currentColor", stroke: "#fff" } : {})}
            />
            <span>{hint.text}</span>
          </p>
          {editable ? (
            <Link href={`/dossiers/${d.id}/modifier`} className="mp-btn mp-btn--secondary mp-btn--sm mp-dcard__action">
              {d.status === "NEEDS_INFO" ? "Reprendre le dossier" : "Continuer"}
            </Link>
          ) : (
            <ChevronRight className="mp-dcard__chevron" aria-hidden />
          )}
        </div>
        <p className="mp-dcard__meta">
          {d.reference} · Mis à jour {formatRelative(d.updatedAt).toLowerCase()}
          {showOwner && <> · {d.ownerName}</>}
        </p>
      </div>
    </article>
  );
}
