import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth/current";
import { DomainError } from "@/server/errors";
import { getDossierDetail, type DossierDetail } from "@/server/services/dossiers";
import { DossierWizard } from "@/ui/wizard/DossierWizard";

export const metadata: Metadata = { title: "Modifier le dossier" };

export default async function EditDossierPage({ params, searchParams }: PageProps<"/dossiers/[id]/modifier">) {
  const user = await requirePageUser(["commercial"]);
  const { id } = await params;
  const sp = await searchParams;
  let detail: DossierDetail;
  try {
    detail = await getDossierDetail(user, id);
  } catch (err) {
    if (err instanceof DomainError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  // Après transmission, plus de modification libre : retour au détail.
  if (!detail.canEdit) redirect(`/dossiers/${id}`);
  const step = Math.min(Math.max(Number(sp.etape ?? 1) - 1, 0), 2) || 0;

  return (
    <DossierWizard
      key={detail.id}
      ownerName={detail.ownerName}
      initialStep={step}
      initial={{
        id: detail.id,
        reference: detail.reference,
        status: detail.status,
        version: detail.version,
        data: detail.data,
        documents: detail.documents,
        lastAdvMessage: detail.lastAdvMessage,
        updatedAt: detail.updatedAt,
        createdAt: detail.createdAt,
      }}
    />
  );
}
