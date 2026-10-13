import {
  FIELD_LABELS,
  GROUPEMENT_LABELS,
  PAYMENT_LABELS,
  type DossierData,
  type GroupementType,
  type PaymentMethod,
} from "@/domain/dossier";
import { formatIban, formatPhone, formatSiret, maskIban } from "@/domain/formats";

/** Valeurs affichables d'un dossier (formatage FR, IBAN masqué par défaut). */
export function summaryRows(data: DossierData, opts: { revealIban?: boolean } = {}): { label: string; value: string }[] {
  const groupement =
    data.groupementType === "groupement"
      ? `${GROUPEMENT_LABELS.groupement}${data.groupementName ? ` — ${data.groupementName}` : ""}`
      : data.groupementType
        ? GROUPEMENT_LABELS[data.groupementType as GroupementType]
        : "";
  return [
    { label: FIELD_LABELS.cipCode, value: data.cipCode },
    { label: FIELD_LABELS.siret, value: data.siret ? formatSiret(data.siret) : "" },
    { label: "Titulaire", value: data.ownerName },
    { label: FIELD_LABELS.pharmacyName, value: data.pharmacyName },
    { label: FIELD_LABELS.address, value: data.address },
    { label: "Code postal / Ville", value: [data.postalCode, data.city].filter(Boolean).join(" ") },
    { label: FIELD_LABELS.phone, value: data.phone ? formatPhone(data.phone) : "" },
    { label: FIELD_LABELS.email, value: data.email },
    { label: FIELD_LABELS.groupementType, value: groupement },
    { label: "Règlement", value: data.paymentMethod ? PAYMENT_LABELS[data.paymentMethod as PaymentMethod] : "" },
    { label: FIELD_LABELS.iban, value: data.iban ? (opts.revealIban ? formatIban(data.iban) : maskIban(data.iban)) : "" },
    { label: "Réf. Quadra (prospect)", value: data.quadraProspectRef },
    { label: FIELD_LABELS.comments, value: data.comments },
  ];
}

export function DossierSummary({ data, revealIban }: { data: DossierData; revealIban?: boolean }) {
  return (
    <dl className="mp-dl">
      {summaryRows(data, { revealIban }).map((r) => (
        <div key={r.label} style={{ display: "contents" }}>
          <dt>{r.label}</dt>
          <dd className={r.value ? (r.label === FIELD_LABELS.iban ? "mp-mono" : undefined) : "mp-dl__empty"}>
            {r.value || "Non renseigné"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
