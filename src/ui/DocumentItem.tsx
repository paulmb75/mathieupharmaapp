import { ExternalLink, FileText } from "lucide-react";
import { formatDateTime } from "@/domain/dates";
import { formatBytes, isImage, isPreviewable } from "@/domain/documents";
import type { ReactNode } from "react";

export type DocumentItemData = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date | string;
  uploadedByName?: string;
  removedAt?: Date | string | null;
};

/** Ligne de justificatif. Les fichiers passent par /api/documents/:id (accès contrôlé). */
export function DocumentItem({ doc, actions, page }: { doc: DocumentItemData; actions?: ReactNode; page?: number }) {
  const url = `/api/documents/${doc.id}`;
  const previewable = isPreviewable(doc.mimeType);
  return (
    <div className={`mp-doc${doc.removedAt ? " mp-doc--removed" : ""}`}>
      <a className="mp-doc__thumb" href={url} target="_blank" rel="noopener" aria-label={`Ouvrir ${doc.originalName}`}>
        {isImage(doc.mimeType) && previewable ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" loading="lazy" />
        ) : doc.mimeType === "application/pdf" ? (
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <FileText aria-hidden style={{ width: 22, height: 22 }} />
            PDF
          </span>
        ) : (
          "HEIC"
        )}
      </a>
      <div className="mp-doc__body">
        <p className="mp-doc__name" title={doc.originalName}>
          {page ? `Page ${page} — ` : ""}
          {doc.originalName}
        </p>
        <p className="mp-doc__meta">
          {formatBytes(doc.sizeBytes)} · Ajouté le {formatDateTime(doc.createdAt)}
          {doc.uploadedByName ? ` par ${doc.uploadedByName}` : ""}
          {doc.removedAt ? ` · Retiré le ${formatDateTime(doc.removedAt)}` : ""}
        </p>
      </div>
      <div className="mp-doc__actions">
        <a className="mp-iconbtn mp-doc__open" href={url} target="_blank" rel="noopener" aria-label={previewable ? "Ouvrir dans un nouvel onglet" : "Télécharger"}>
          <ExternalLink aria-hidden style={{ width: 20, height: 20 }} />
        </a>
        {actions}
      </div>
    </div>
  );
}
