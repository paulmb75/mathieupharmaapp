"use client";

import { useRef } from "react";
import { Camera, FileText, Lock, Trash2, Upload } from "lucide-react";
import {
  ACCEPT_ATTRIBUTE,
  DOCUMENT_HINTS,
  DOCUMENT_KINDS,
  DOCUMENT_LABELS,
  MAX_FILES_PER_KIND,
  type DocumentKind,
} from "@/domain/documents";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { Callout } from "../Callout";
import { DocumentItem } from "../DocumentItem";
import { SectionBanner } from "../PageHeader";
import type { WizardDocument } from "./types";

export type UploadState = { total: number; done: number } | null;

type Props = {
  docs: WizardDocument[];
  uploading: Record<DocumentKind, UploadState>;
  errors: Record<DocumentKind, string | null>;
  onUpload: (kind: DocumentKind, files: File[]) => void;
  onRemove: (doc: WizardDocument) => void;
};

function KindCard({
  kind,
  docs,
  uploading,
  error,
  onUpload,
  onRemove,
}: { kind: DocumentKind; docs: WizardDocument[]; uploading: UploadState; error: string | null } & Pick<Props, "onUpload" | "onRemove">) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const full = docs.length >= MAX_FILES_PER_KIND;
  const label = kind === "KBIS" ? "le KBIS" : "le RIB";

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) onUpload(kind, files);
  }

  return (
    <section className="mp-card mp-doc-card" aria-labelledby={`doc-${kind}`}>
      <div className="mp-doc-card__head">
        <span className="mp-icon-circle">
          <FileText aria-hidden />
        </span>
        <h3 className="mp-doc-card__title" id={`doc-${kind}`}>
          {DOCUMENT_LABELS[kind]}
          <span className="mp-doc-card__hint" style={{ display: "block" }}>
            {DOCUMENT_HINTS[kind]}
          </span>
        </h3>
        {docs.length > 0 && (
          <Badge tone="success" size="sm">
            {docs.length > 1 ? `${docs.length} pages` : "Reçu"}
          </Badge>
        )}
      </div>

      {docs.length > 0 && (
        <div className="mp-doc-list">
          {docs.map((d, i) => (
            <DocumentItem
              key={d.id}
              doc={d}
              page={docs.length > 1 ? i + 1 : undefined}
              actions={
                <button type="button" className="mp-iconbtn" onClick={() => onRemove(d)} aria-label={`Retirer ${d.originalName}`}>
                  <Trash2 aria-hidden style={{ width: 20, height: 20, color: "var(--mp-danger-fg)" }} />
                </button>
              }
            />
          ))}
        </div>
      )}

      <div className={`mp-dropzone${docs.length ? " mp-dropzone--compact" : ""}`}>
        {!docs.length && (
          <>
            <Camera className="mp-dropzone__icon" aria-hidden />
            <p className="mp-dropzone__text">
              {kind === "KBIS" ? "Ajoutez toutes les pages." : "Photo nette, IBAN lisible."}
            </p>
          </>
        )}
        {uploading ? (
          <p className="mp-upload-progress" role="status">
            <span className="mp-spinner" aria-hidden /> Envoi {uploading.done + 1}/{uploading.total}…
          </p>
        ) : (
          <>
            <Button
              variant={docs.length ? "secondary" : "primary"}
              size={docs.length ? "sm" : "md"}
              icon={<Camera aria-hidden />}
              onClick={() => cameraRef.current?.click()}
              disabled={full}
            >
              {docs.length ? "Ajouter une page" : `Photographier ${label}`}
            </Button>
            <button type="button" className="mp-textlink" onClick={() => fileRef.current?.click()} disabled={full} style={{ fontWeight: 600 }}>
              <Upload aria-hidden style={{ width: 18, height: 18 }} /> Importer un fichier
            </button>
          </>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
        <input ref={fileRef} type="file" accept={ACCEPT_ATTRIBUTE} multiple hidden onChange={handle} />
      </div>
      {error && (
        <div style={{ padding: "0 16px 16px" }}>
          <Callout tone="danger" title={error} />
        </div>
      )}
    </section>
  );
}

export function StepDocuments({ docs, uploading, errors, onUpload, onRemove }: Props) {
  const missing = DOCUMENT_KINDS.filter((k) => !docs.some((d) => d.kind === k));
  return (
    <div className="mp-stack mp-stack--lg">
      <SectionBanner icon={<FileText aria-hidden />} title="Les pièces du dossier" subtitle="Un RIB et un KBIS sont nécessaires." />
      {DOCUMENT_KINDS.map((k) => (
        <KindCard
          key={k}
          kind={k}
          docs={docs.filter((d) => d.kind === k)}
          uploading={uploading[k]}
          error={errors[k]}
          onUpload={onUpload}
          onRemove={onRemove}
        />
      ))}
      {missing.length > 0 && (
        <Callout
          tone="warning"
          title={
            missing.length === 2
              ? "Le KBIS et le RIB manquent pour transmettre"
              : `Le ${missing[0]} manque pour transmettre`
          }
        >
          Vous pouvez enregistrer le brouillon et ajouter les pièces plus tard.
        </Callout>
      )}
      <p className="mp-privacy-note">
        <Lock aria-hidden /> Pièces accessibles uniquement à vous et à l’ADV. PDF, JPEG, PNG, WEBP ou HEIC, 10 Mo maximum par
        fichier.
      </p>
    </div>
  );
}
