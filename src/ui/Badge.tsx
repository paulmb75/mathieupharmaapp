import type { ReactNode } from "react";
import { STATUS_LABELS, STATUS_TONES, type DossierStatus, type StatusTone } from "@/domain/status";

export function Badge({ tone = "neutral", size, children }: { tone?: StatusTone; size?: "sm"; children: ReactNode }) {
  return <span className={`mp-badge mp-badge--${tone}${size ? ` mp-badge--${size}` : ""}`}>{children}</span>;
}

export function StatusBadge({ status, size }: { status: DossierStatus; size?: "sm" }) {
  return (
    <Badge tone={STATUS_TONES[status]} size={size}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function SoonTag() {
  return <span className="mp-soon">À venir</span>;
}
