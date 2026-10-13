"use client";

import { AlertCircle, CheckCircle2, FileText, Info, Pencil, Store } from "lucide-react";
import { DOCUMENT_KINDS, DOCUMENT_LABELS } from "@/domain/documents";
import { FIELD_LABELS, type DossierData, type SubmissionCheck } from "@/domain/dossier";
import { maskIban } from "@/domain/formats";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { Callout } from "../Callout";
import { DossierSummary } from "../DossierSummary";
import { Field, TextArea } from "../Field";
import { SectionBanner } from "../PageHeader";
import type { WizardDocument } from "./types";

type Props = {
  data: DossierData;
  docs: WizardDocument[];
  check: SubmissionCheck;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  goTo: (step: number) => void;
  isResubmission: boolean;
  reply: string;
  onReply: (v: string) => void;
};

export function StepReview({ data, docs, check, confirmed, onConfirm, goTo, isResubmission, reply, onReply }: Props) {
  const issues = [
    ...check.missing.map((f) => ({ key: f, text: `${FIELD_LABELS[f]} : à renseigner`, step: 0 })),
    ...check.invalid.map((i) => ({ key: `${i.field}-fmt`, text: i.message, step: 0 })),
    ...check.missingDocuments.map((k) => ({ key: k, text: `${DOCUMENT_LABELS[k]} : à ajouter`, step: 1 })),
  ];

  return (
    <div className="mp-stack mp-stack--lg">
      <SectionBanner icon={<FileText aria-hidden />} title="Vérifier avant envoi" subtitle="Relisez les informations puis confirmez." />

      {issues.length > 0 && (
        <Callout tone="warning" title={`${issues.length} point${issues.length > 1 ? "s" : ""} à régler avant la transmission`}>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {issues.map((i) => (
              <li key={i.key}>
                <button type="button" className="mp-textlink" style={{ minHeight: 32, fontSize: 14, padding: 0 }} onClick={() => goTo(i.step)}>
                  {i.text}
                </button>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <section className="mp-card">
        <div className="mp-card__head">
          <h3 className="mp-card__title">
            <span className="mp-icon-circle mp-icon-circle--sm">
              <Store aria-hidden />
            </span>
            {data.pharmacyName || "Pharmacie sans nom"}
          </h3>
          <Button variant="secondary" size="sm" icon={<Pencil aria-hidden />} onClick={() => goTo(0)}>
            Modifier
          </Button>
        </div>
        <div className="mp-card__body">
          <DossierSummary data={data} />
        </div>
      </section>

      <section className="mp-card">
        <div className="mp-card__head">
          <h3 className="mp-card__title" style={{ fontSize: 16 }}>
            Pièces jointes
          </h3>
          <Button variant="secondary" size="sm" icon={<Pencil aria-hidden />} onClick={() => goTo(1)}>
            Gérer
          </Button>
        </div>
        <div className="mp-card__body mp-stack">
          {DOCUMENT_KINDS.map((k) => {
            const list = docs.filter((d) => d.kind === k);
            return (
              <div key={k} className="mp-doc">
                <span className="mp-icon-circle mp-icon-circle--sm">
                  <FileText aria-hidden />
                </span>
                <div className="mp-doc__body">
                  <p className="mp-doc__name">{DOCUMENT_LABELS[k]}</p>
                  <p className="mp-doc__meta">
                    {list.length
                      ? `${list.length > 1 ? `${list.length} fichiers` : list[0]!.originalName}${k === "RIB" && data.iban ? ` · IBAN : ${maskIban(data.iban)}` : ""}`
                      : "Aucun fichier"}
                  </p>
                </div>
                {list.length ? (
                  <Badge tone="success" size="sm">
                    <CheckCircle2 aria-hidden /> Reçu
                  </Badge>
                ) : (
                  <Badge tone="warning" size="sm">
                    <AlertCircle aria-hidden /> Manquant
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isResubmission && (
        <Field id="reply" label="Réponse à l’ADV (facultatif)" plainLabel hint="Précisez ce qui a été corrigé.">
          <TextArea id="reply" value={reply} maxLength={2000} onChange={(e) => onReply(e.target.value)} placeholder="Ex. : RIB remplacé par une version lisible" />
        </Field>
      )}

      <label className="mp-check">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} />
        <span>Je confirme l’exactitude des informations du dossier.</span>
      </label>

      <Callout tone="info" icon={<Info className="mp-callout__icon" aria-hidden />}>
        L’ADV vérifie le dossier puis crée le compte dans Quadra. Vous suivrez chaque étape dans Dossiers.
      </Callout>
    </div>
  );
}
