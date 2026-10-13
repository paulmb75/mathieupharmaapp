"use client";

import { CheckCircle2, Store } from "lucide-react";
import {
  FIELD_LABELS,
  GROUPEMENT_LABELS,
  GROUPEMENT_TYPES,
  isRequiredField,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  type DossierData,
  type DossierField,
} from "@/domain/dossier";
import { isValidIban, isValidSiret } from "@/domain/formats";
import { Field, Select, TextArea, TextInput } from "../Field";
import { SectionBanner } from "../PageHeader";

type Props = {
  data: DossierData;
  errors: Partial<Record<DossierField, string>>;
  onChange: (field: DossierField, value: string) => void;
  onBlur: (field: DossierField) => void;
};

export function StepInfo({ data, errors, onChange, onBlur }: Props) {
  const text = (
    field: DossierField,
    opts: { inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; autoComplete?: string; placeholder?: string; type?: string; label?: string; hint?: React.ReactNode; maxLength?: number } = {},
  ) => (
    <Field
      id={field}
      label={opts.label ?? FIELD_LABELS[field]}
      required={isRequiredField(field, data)}
      error={errors[field]}
      hint={opts.hint}
    >
      <TextInput
        id={field}
        name={field}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        autoComplete={opts.autoComplete ?? "off"}
        placeholder={opts.placeholder}
        maxLength={opts.maxLength}
        value={data[field]}
        invalid={!!errors[field]}
        onChange={(e) => onChange(field, e.target.value)}
        onBlur={() => onBlur(field)}
      />
    </Field>
  );

  const siretOk = data.siret.trim() !== "" && isValidSiret(data.siret) && !errors.siret;
  const ibanOk = data.iban.trim() !== "" && isValidIban(data.iban) && !errors.iban;

  return (
    <div className="mp-form">
      <SectionBanner icon={<Store aria-hidden />} title="La pharmacie" />

      {text("cipCode", { inputMode: "numeric", maxLength: 20, placeholder: "7 chiffres" })}
      {text("siret", {
        inputMode: "numeric",
        maxLength: 20,
        placeholder: "14 chiffres",
        hint: siretOk ? (
          <span className="mp-field-ok">
            <CheckCircle2 aria-hidden /> Format valide — l’ADV vérifiera la correspondance avec le KBIS
          </span>
        ) : (
          "Figure sur le KBIS."
        ),
      })}
      {text("ownerName", { label: "Nom du titulaire (propriétaire)", autoComplete: "off" })}
      {text("pharmacyName")}
      {text("address", { autoComplete: "off" })}
      <div className="mp-field-row">
        {text("postalCode", { inputMode: "numeric", maxLength: 10 })}
        {text("city")}
      </div>
      <div className="mp-field-row mp-field-row--even">
        {text("phone", { inputMode: "tel", type: "tel" })}
        {text("email", { inputMode: "email", type: "email", placeholder: "Adresse e-mail" })}
      </div>

      <Field id="groupementType" label={FIELD_LABELS.groupementType} required error={errors.groupementType}>
        <Select
          id="groupementType"
          value={data.groupementType}
          invalid={!!errors.groupementType}
          onChange={(e) => onChange("groupementType", e.target.value)}
          onBlur={() => onBlur("groupementType")}
        >
          <option value="">Sélectionner…</option>
          {GROUPEMENT_TYPES.map((g) => (
            <option key={g} value={g}>
              {GROUPEMENT_LABELS[g]}
            </option>
          ))}
        </Select>
      </Field>
      {data.groupementType === "groupement" && text("groupementName")}

      <h3 className="mp-subsection-title">Règlement</h3>
      <Field
        id="paymentMethod"
        label={FIELD_LABELS.paymentMethod}
        required
        error={errors.paymentMethod}
        hint="Liste provisoire, à confirmer avec l’ADV."
      >
        <Select
          id="paymentMethod"
          value={data.paymentMethod}
          invalid={!!errors.paymentMethod}
          onChange={(e) => onChange("paymentMethod", e.target.value)}
          onBlur={() => onBlur("paymentMethod")}
        >
          <option value="">Sélectionner…</option>
          {PAYMENT_METHODS.map((p) => (
            <option key={p} value={p}>
              {PAYMENT_LABELS[p]}
            </option>
          ))}
        </Select>
      </Field>
      {text("iban", {
        label: "IBAN (facultatif)",
        maxLength: 42,
        placeholder: "FR76 …",
        hint: ibanOk ? (
          <span className="mp-field-ok">
            <CheckCircle2 aria-hidden /> Format valide — l’ADV vérifiera qu’il correspond au RIB
          </span>
        ) : (
          "Recopié depuis le RIB. Un format valide ne prouve pas que le compte appartient à la pharmacie."
        ),
      })}

      <h3 className="mp-subsection-title">Compléments</h3>
      {text("quadraProspectRef", {
        label: "Référence prospect / client Quadra (facultatif)",
        hint: "Si la pharmacie existe déjà comme prospect dans Quadra.",
        maxLength: 40,
      })}
      <Field
        id="comments"
        label={FIELD_LABELS.comments}
        error={errors.comments}
        hint="Jours de fermeture, horaires de livraison, informations utiles à l’ADV."
      >
        <TextArea
          id="comments"
          value={data.comments}
          maxLength={2000}
          onChange={(e) => onChange("comments", e.target.value)}
          onBlur={() => onBlur("comments")}
          placeholder="Ex. : fermée le lundi matin"
        />
      </Field>
      <p className="mp-form-note">* Champs obligatoires pour transmettre le dossier. Un brouillon peut rester incomplet.</p>
    </div>
  );
}
