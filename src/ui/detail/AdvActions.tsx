"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, MessageSquareWarning, XCircle } from "lucide-react";
import { BUSINESS_CHECK_LABELS, BUSINESS_CHECKS, type BusinessCheck } from "@/domain/adv";
import type { DossierStatus, TransitionAction } from "@/domain/status";
import { Button } from "../Button";
import { Callout } from "../Callout";
import { Field, TextArea, TextInput } from "../Field";
import { Dialog } from "../client/Dialog";
import { apiFetch, errorMessage } from "../client/api";

type Props = {
  dossierId: string;
  status: DossierStatus;
  actions: TransitionAction[];
  proposedIdentifier: string | null;
  prospectRef: string | null;
};

export function AdvActions({ dossierId, status, actions, proposedIdentifier, prospectRef }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<TransitionAction | null>(null);
  const [message, setMessage] = useState("");
  const [accountRef, setAccountRef] = useState("");
  const [checks, setChecks] = useState<BusinessCheck[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog(a: TransitionAction) {
    setMessage("");
    setAccountRef("");
    setChecks([]);
    setError(null);
    setOpen(a);
  }

  async function run() {
    if (!open || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/dossiers/${dossierId}/transitions/${open}`, {
        method: "POST",
        json: {
          expectedStatus: status,
          ...(message.trim() ? { message: message.trim() } : {}),
          ...(open === "confirm_quadra" ? { quadraAccountRef: accountRef.trim() } : {}),
          ...(open === "validate" ? { checks } : {}),
        },
      });
      setOpen(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!actions.length) {
    return <p className="mp-small mp-muted">Aucune action ADV possible dans ce statut.</p>;
  }

  const canRun =
    open === "request_info" || open === "reject"
      ? message.trim().length > 0
      : open === "validate"
        ? checks.length === BUSINESS_CHECKS.length
        : open === "confirm_quadra"
          ? accountRef.trim().length > 0
          : false;

  return (
    <div className="mp-stack">
      {actions.includes("validate") && (
        <Button variant="success" block icon={<BadgeCheck aria-hidden />} onClick={() => openDialog("validate")}>
          Valider le dossier
        </Button>
      )}
      {actions.includes("confirm_quadra") && (
        <Button block icon={<Building2 aria-hidden />} onClick={() => openDialog("confirm_quadra")}>
          Confirmer la création dans Quadra
        </Button>
      )}
      {actions.includes("request_info") && (
        <Button variant="secondary" block icon={<MessageSquareWarning aria-hidden />} onClick={() => openDialog("request_info")}>
          Demander un complément
        </Button>
      )}
      {actions.includes("reject") && (
        <Button variant="danger-outline" block icon={<XCircle aria-hidden />} onClick={() => openDialog("reject")}>
          Refuser le dossier
        </Button>
      )}

      <Dialog
        open={open !== null}
        onClose={() => !pending && setOpen(null)}
        title={
          open === "validate"
            ? "Valider le dossier"
            : open === "confirm_quadra"
              ? "Confirmer la création dans Quadra"
              : open === "request_info"
                ? "Demander un complément"
                : "Refuser le dossier"
        }
      >
        {error && <Callout tone="danger" title={error} />}

        {open === "validate" && (
          <>
            <p className="mp-small mp-muted">
              Les contrôles automatiques ne vérifient que le format. Confirmez les vérifications métier effectuées sur les
              pièces :
            </p>
            {BUSINESS_CHECKS.map((c) => (
              <label key={c} className="mp-check">
                <input
                  type="checkbox"
                  checked={checks.includes(c)}
                  onChange={(e) => setChecks((cur) => (e.target.checked ? [...cur, c] : cur.filter((x) => x !== c)))}
                />
                <span>{BUSINESS_CHECK_LABELS[c]}</span>
              </label>
            ))}
            <Field id="adv-msg" label="Commentaire (facultatif)" plainLabel>
              <TextArea id="adv-msg" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <Callout tone="info">La validation ne crée pas le compte : la création dans Quadra se confirme séparément.</Callout>
          </>
        )}

        {open === "confirm_quadra" && (
          <>
            <Callout tone="warning" title="Aucune écriture automatique dans Quadra">
              Créez d’abord le compte manuellement dans Quadra, puis saisissez sa référence ici.
            </Callout>
            <Field
              id="quadra-ref"
              label="Référence du compte Quadra"
              required
              plainLabel
              hint={
                <>
                  {prospectRef && <>Prospect indiqué par le commercial : {prospectRef}. </>}
                  {proposedIdentifier && <>Identifiant proposé (règle provisoire, à confirmer) : {proposedIdentifier}.</>}
                </>
              }
            >
              <TextInput
                id="quadra-ref"
                value={accountRef}
                maxLength={40}
                autoComplete="off"
                onChange={(e) => setAccountRef(e.target.value)}
              />
            </Field>
            <Field id="adv-msg" label="Commentaire (facultatif)" plainLabel>
              <TextArea id="adv-msg" value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} />
            </Field>
          </>
        )}

        {(open === "request_info" || open === "reject") && (
          <Field
            id="adv-msg"
            label={open === "reject" ? "Motif du refus" : "Pièce ou information attendue"}
            required
            plainLabel
            hint={open === "reject" ? "Le motif est communiqué au commercial." : "Ce message est affiché au commercial sur le dossier."}
          >
            <TextArea
              id="adv-msg"
              value={message}
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={open === "reject" ? "Ex. : pharmacie déjà cliente sous un autre SIRET" : "Ex. : RIB illisible, merci d’en joindre une photo nette"}
              autoFocus
            />
          </Field>
        )}

        <div className="mp-dialog__actions">
          <Button variant="neutral" onClick={() => setOpen(null)} disabled={pending}>
            Annuler
          </Button>
          <Button
            variant={open === "reject" ? "danger" : open === "validate" ? "success" : "primary"}
            onClick={run}
            loading={pending}
            disabled={!canRun}
          >
            {open === "validate"
              ? "Valider"
              : open === "confirm_quadra"
                ? "Confirmer la création"
                : open === "request_info"
                  ? "Envoyer la demande"
                  : "Refuser"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
