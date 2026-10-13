import type { DocumentKind } from "@/domain/documents";
import type { DossierData } from "@/domain/dossier";
import type { DossierStatus } from "@/domain/status";

export type WizardDocument = {
  id: string;
  kind: DocumentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date | string;
};

export type WizardInitial = {
  id: string;
  reference: string;
  status: DossierStatus;
  version: number;
  data: DossierData;
  documents: WizardDocument[];
  lastAdvMessage: string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
};
