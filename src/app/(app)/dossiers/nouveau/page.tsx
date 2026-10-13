import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/current";
import { DossierWizard } from "@/ui/wizard/DossierWizard";

export const metadata: Metadata = { title: "Nouvelle ouverture" };

export default async function NewDossierPage() {
  const user = await requirePageUser(["commercial"]);
  return <DossierWizard initial={null} ownerName={user.fullName} initialStep={0} />;
}
