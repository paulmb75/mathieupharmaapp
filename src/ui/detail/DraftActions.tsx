"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "../Button";
import { apiFetch, errorMessage } from "../client/api";

export function DeleteDraftButton({ dossierId }: { dossierId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function del() {
    if (!window.confirm("Supprimer définitivement ce brouillon et ses pièces ?")) return;
    setPending(true);
    try {
      await apiFetch(`/api/dossiers/${dossierId}`, { method: "DELETE" });
      router.push("/dossiers");
      router.refresh();
    } catch (err) {
      window.alert(errorMessage(err));
      setPending(false);
    }
  }
  return (
    <Button variant="danger-outline" block icon={<Trash2 aria-hidden />} onClick={del} loading={pending}>
      Supprimer le brouillon
    </Button>
  );
}
