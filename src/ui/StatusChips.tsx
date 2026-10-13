import Link from "next/link";
import type { DossierStatus } from "@/domain/status";

export type ChipDef = { key: string; label: string; statuses: DossierStatus[] };

export function StatusChips({
  basePath,
  chips,
  activeKey,
  q,
  counts,
}: {
  basePath: string;
  chips: ChipDef[];
  activeKey: string;
  q?: string;
  counts: Record<DossierStatus, number>;
}) {
  return (
    <nav className="mp-chips" aria-label="Filtrer par statut">
      {chips.map((c) => {
        const sp = new URLSearchParams();
        if (q) sp.set("q", q);
        c.statuses.forEach((s) => sp.append("statut", s));
        const href = `${basePath}${sp.toString() ? `?${sp}` : ""}`;
        const n = c.statuses.length ? c.statuses.reduce((a, s) => a + counts[s], 0) : null;
        const active = c.key === activeKey;
        return (
          <Link key={c.key} href={href} className={`mp-chip${active ? " mp-chip--active" : ""}`} aria-current={active ? "true" : undefined} scroll={false}>
            {c.label}
            {n !== null && <span className="mp-chip__count">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function activeChipKey(chips: ChipDef[], selected: DossierStatus[]): string {
  const key = [...selected].sort().join(",");
  return chips.find((c) => [...c.statuses].sort().join(",") === key)?.key ?? chips[0]!.key;
}
