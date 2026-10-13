"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { formatIban, isValidIban, maskIban } from "@/domain/formats";

/** IBAN masqué par défaut, affichable à la demande (ADV). */
export function IbanReveal({ iban }: { iban: string }) {
  const [shown, setShown] = useState(false);
  const valid = isValidIban(iban);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span className="mp-mono">{shown ? formatIban(iban) : maskIban(iban)}</span>
      <button type="button" className="mp-textlink" style={{ minHeight: 28, fontSize: 13 }} onClick={() => setShown((s) => !s)}>
        {shown ? <EyeOff aria-hidden style={{ width: 16, height: 16 }} /> : <Eye aria-hidden style={{ width: 16, height: 16 }} />}
        {shown ? "Masquer" : "Afficher"}
      </button>
      <span className={`mp-badge mp-badge--sm mp-badge--${valid ? "warning" : "danger"}`} style={{ whiteSpace: "normal" }}>
        {valid ? "Format valide · à vérifier sur le RIB" : "Format invalide"}
      </span>
    </span>
  );
}
