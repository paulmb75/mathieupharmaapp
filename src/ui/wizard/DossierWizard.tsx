"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send } from "lucide-react";
import { formatDate, formatDateTime } from "@/domain/dates";
import { MAX_FILE_BYTES, type DocumentKind } from "@/domain/documents";
import {
  checkSubmission,
  DOSSIER_FIELDS,
  emptyDossierData,
  formatIssues,
  missingFields,
  type DossierData,
  type DossierField,
} from "@/domain/dossier";
import { Button } from "../Button";
import { Callout } from "../Callout";
import { Logo } from "../Logo";
import { Stepper } from "../Stepper";
import { apiFetch, ApiRequestError, errorMessage, randomKey } from "../client/api";
import { SaveIndicator, type SaveState } from "../client/SaveIndicator";
import { StepDocuments, type UploadState } from "./StepDocuments";
import { StepInfo } from "./StepInfo";
import { StepReview } from "./StepReview";
import type { WizardDocument, WizardInitial } from "./types";

const STEPS = ["Informations", "Pièces", "Vérification"];
const AUTOSAVE_DELAY = 1200;
const RETRY_DELAY = 15000;
const BACKUP_PREFIX = "mp:dossier:";

type Backup = { data: DossierData; creationKey?: string; at: number };

function sameData(a: DossierData, b: DossierData): boolean {
  return DOSSIER_FIELDS.every((f) => (a[f] ?? "") === (b[f] ?? ""));
}

function isEmpty(d: DossierData): boolean {
  return DOSSIER_FIELDS.every((f) => !(d[f] ?? "").trim());
}

/**
 * Copie locale de secours en cas de coupure réseau. Ce n'est PAS la base métier :
 * le dossier fait foi côté serveur. L'IBAN n'y est jamais écrit.
 */
function readBackup(key: string): Backup | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}

function writeBackup(key: string, backup: Backup) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...backup, data: { ...backup.data, iban: "" } }));
  } catch {
    /* stockage indisponible (navigation privée) : on continue sans copie locale */
  }
}

function removeBackup(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignoré */
  }
}

/** Réduit les photos volumineuses avant envoi (lisibilité préservée, envoi plus rapide en mobilité). */
async function prepareImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < 2.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function DossierWizard({
  initial,
  ownerName,
  initialStep,
}: {
  initial: WizardInitial | null;
  ownerName: string;
  initialStep: number;
}) {
  const router = useRouter();
  const startData = useMemo(() => initial?.data ?? emptyDossierData(), [initial]);

  const idRef = useRef<string | null>(initial?.id ?? null);
  const versionRef = useRef<number>(initial?.version ?? 0);
  const creationKeyRef = useRef<string>("");
  const dataRef = useRef<DossierData>(startData);
  const savedDataRef = useRef<DossierData>(startData);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(initialStep);

  const [dossierId, setDossierId] = useState<string | null>(initial?.id ?? null);
  const [data, setData] = useState<DossierData>(startData);
  const [docs, setDocs] = useState<WizardDocument[]>(initial?.documents ?? []);
  const [step, setStep] = useState(initialStep);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(initial ? new Date(initial.updatedAt) : null);
  const [touched, setTouched] = useState<Set<DossierField>>(new Set());
  const [showAll, setShowAll] = useState(initialStep === 2);
  const [restore, setRestore] = useState<Backup | null>(null);
  const [uploading, setUploading] = useState<Record<DocumentKind, UploadState>>({ KBIS: null, RIB: null });
  const [docErrors, setDocErrors] = useState<Record<DocumentKind, string | null>>({ KBIS: null, RIB: null });
  const [confirmed, setConfirmed] = useState(false);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const backupKey = () => BACKUP_PREFIX + (idRef.current ?? "nouveau");

  // Copie locale retrouvée (saisie non enregistrée lors d'une précédente coupure).
  useEffect(() => {
    const key = BACKUP_PREFIX + (initial?.id ?? "nouveau");
    const b = readBackup(key);
    creationKeyRef.current = (!initial && b?.creationKey) || randomKey();
    if (!b) return;
    const serverTime = initial ? new Date(initial.updatedAt).getTime() : 0;
    const differs = !sameData({ ...b.data, iban: startData.iban }, startData);
    if (differs && b.at > serverTime && !isEmpty(b.data)) setRestore(b);
    else removeBackup(key);
  }, [initial, startData]);

  const save = useCallback(async (opts: { force?: boolean } = {}): Promise<boolean> => {
    // File d'attente stricte : un seul enregistrement à la fois (sinon deux requêtes
    // partiraient avec la même version et la seconde serait refusée à tort).
    while (savingRef.current) await savingRef.current;
    const snapshot = dataRef.current;
    if (idRef.current && sameData(snapshot, savedDataRef.current)) {
      setSaveState((s) => (s === "dirty" || s === "saving" ? "saved" : s));
      return true;
    }
    if (!idRef.current && !opts.force && isEmpty(snapshot)) return true;

    const run = (async () => {
      setSaveState("saving");
      setSaveMessage(null);
      try {
        if (!idRef.current) {
          const res = await apiFetch<{ id: string; version: number; created: boolean }>("/api/dossiers", {
            method: "POST",
            json: { creationKey: creationKeyRef.current, data: snapshot },
          });
          idRef.current = res.id;
          versionRef.current = res.version;
          setDossierId(res.id);
          removeBackup(BACKUP_PREFIX + "nouveau");
          window.history.replaceState(null, "", `/dossiers/${res.id}/modifier?etape=${stepRef.current + 1}`);
          if (!res.created) {
            // Nouvelle tentative après coupure : le brouillon existait déjà, on y écrit la saisie actuelle.
            const upd = await apiFetch<{ version: number }>(`/api/dossiers/${res.id}`, {
              method: "PATCH",
              json: { version: res.version, data: snapshot },
            });
            versionRef.current = upd.version;
          }
        } else {
          const res = await apiFetch<{ version: number }>(`/api/dossiers/${idRef.current}`, {
            method: "PATCH",
            json: { version: versionRef.current, data: snapshot },
          });
          versionRef.current = res.version;
        }
        savedDataRef.current = snapshot;
        setSavedAt(new Date());
        const stillDirty = !sameData(dataRef.current, snapshot);
        setSaveState(stillDirty ? "dirty" : "saved");
        if (!stillDirty) removeBackup(backupKey());
        return true;
      } catch (err) {
        if (err instanceof ApiRequestError && err.error.network) {
          setSaveState("offline");
          if (retryRef.current) clearTimeout(retryRef.current);
          retryRef.current = setTimeout(() => void save(), RETRY_DELAY);
        } else if (err instanceof ApiRequestError && err.error.status === 409) {
          setSaveState("conflict");
          setSaveMessage(err.error.message);
        } else {
          setSaveState("error");
          setSaveMessage(errorMessage(err));
        }
        return false;
      } finally {
        savingRef.current = null;
      }
    })();
    savingRef.current = run;
    return run;
  }, []);

  // Reprise automatique au retour du réseau.
  useEffect(() => {
    const onOnline = () => void save();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [save]);

  // Avertit avant de quitter la page si des modifications ne sont pas enregistrées.
  useEffect(() => {
    const pending = ["dirty", "saving", "offline", "error"].includes(saveState);
    if (!pending || submitting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState, submitting]);

  useEffect(
    () => () => {
      [timerRef, retryRef].forEach((r) => r.current && clearTimeout(r.current));
    },
    [],
  );

  function applyData(next: DossierData) {
    dataRef.current = next;
    setData(next);
    if (saveState !== "conflict") setSaveState("dirty");
    // Écriture immédiate : la saisie survit à une fermeture de page juste après une coupure.
    writeBackup(backupKey(), { data: next, creationKey: creationKeyRef.current, at: Date.now() });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), AUTOSAVE_DELAY);
  }

  function update(field: DossierField, value: string) {
    applyData({ ...dataRef.current, [field]: value });
  }

  function blur(field: DossierField) {
    setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
    if (timerRef.current) clearTimeout(timerRef.current);
    void save();
  }

  function goTo(n: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    void save();
    stepRef.current = n;
    setStep(n);
    if (n === 2) setShowAll(true);
    const path = idRef.current ? `/dossiers/${idRef.current}/modifier` : "/dossiers/nouveau";
    window.history.replaceState(null, "", `${path}?etape=${n + 1}`);
    window.scrollTo({ top: 0 });
  }

  async function back() {
    if (step > 0) return goTo(step - 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    await save();
    router.push(idRef.current ? `/dossiers/${idRef.current}` : "/dossiers");
  }

  async function explicitSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    const ok = await save({ force: true });
    if (ok) {
      setToast("Brouillon enregistré");
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function upload(kind: DocumentKind, files: File[]) {
    setDocErrors((e) => ({ ...e, [kind]: null }));
    if (!idRef.current) {
      const ok = await save({ force: true });
      if (!ok || !idRef.current) {
        setDocErrors((e) => ({ ...e, [kind]: "Impossible de créer le brouillon. Vérifiez votre connexion puis réessayez." }));
        return;
      }
    }
    const errors: string[] = [];
    setUploading((u) => ({ ...u, [kind]: { total: files.length, done: 0 } }));
    for (const [i, original] of files.entries()) {
      const file = await prepareImage(original);
      if (file.size > MAX_FILE_BYTES) {
        errors.push(`${original.name} : fichier trop volumineux (10 Mo maximum).`);
      } else {
        const fd = new FormData();
        fd.append("kind", kind);
        fd.append("file", file, file.name);
        try {
          const doc = await apiFetch<WizardDocument>(`/api/dossiers/${idRef.current}/documents`, { method: "POST", body: fd });
          setDocs((d) => [...d, doc]);
        } catch (err) {
          errors.push(`${original.name} : ${errorMessage(err)}`);
        }
      }
      setUploading((u) => ({ ...u, [kind]: { total: files.length, done: i + 1 } }));
    }
    setUploading((u) => ({ ...u, [kind]: null }));
    if (errors.length) setDocErrors((e) => ({ ...e, [kind]: errors.join("\n") }));
  }

  async function remove(doc: WizardDocument) {
    if (!window.confirm(`Retirer « ${doc.originalName} » du dossier ?`)) return;
    try {
      await apiFetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      setDocs((d) => d.filter((x) => x.id !== doc.id));
    } catch (err) {
      setDocErrors((e) => ({ ...e, [doc.kind]: errorMessage(err) }));
    }
  }

  const counts = { KBIS: docs.filter((d) => d.kind === "KBIS").length, RIB: docs.filter((d) => d.kind === "RIB").length };
  const check = checkSubmission(data, counts);

  async function submit() {
    setShowAll(true);
    setSubmitError(null);
    if (!check.ok || !confirmed || submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    const ok = await save();
    if (!ok || !idRef.current) {
      setSubmitting(false);
      setSubmitError("Le dossier n’a pas pu être enregistré. Vérifiez votre connexion puis réessayez.");
      return;
    }
    try {
      await apiFetch(`/api/dossiers/${idRef.current}/transitions/submit`, {
        method: "POST",
        json: reply.trim() ? { message: reply.trim() } : {},
      });
      removeBackup(backupKey());
      router.push(`/dossiers/${idRef.current}?transmis=1`);
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      setSubmitError(errorMessage(err));
    }
  }

  const fieldErrors = useMemo(() => {
    const out: Partial<Record<DossierField, string>> = {};
    for (const i of formatIssues(data)) if (showAll || touched.has(i.field)) out[i.field] = i.message;
    if (showAll) for (const f of missingFields(data)) out[f] ??= "Champ obligatoire pour la transmission.";
    return out;
  }, [data, touched, showAll]);

  const isResubmission = initial?.status === "NEEDS_INFO";

  return (
    <>
      <header className="mp-topbar mp-topbar--form">
        <button type="button" className="mp-textlink" onClick={back} style={{ justifySelf: "start" }}>
          <ChevronLeft aria-hidden /> Retour
        </button>
        <span className="mp-topbar__logo">
          <Logo height={40} />
        </span>
        <button
          type="button"
          className="mp-textlink"
          onClick={explicitSave}
          disabled={saveState === "saving" || (saveState === "saved" && !!dossierId)}
          style={{ fontWeight: 600 }}
        >
          Enregistrer
        </button>
      </header>

      <div className="mp-content mp-content--narrow" style={{ paddingTop: 4 }}>
        <h1 className="mp-page-title">{isResubmission ? "Compléter le dossier" : "Nouvelle ouverture"}</h1>
        <p className="mp-small mp-muted" style={{ marginTop: 4 }}>
          {ownerName} · Demande du {formatDate(initial?.createdAt ?? new Date())}
          {initial?.reference ? ` · ${initial.reference}` : ""}
        </p>
        <SaveIndicator state={saveState} savedAt={savedAt} message={saveMessage} onRetry={() => void save({ force: true })} />

        {saveState === "conflict" && (
          <div style={{ marginTop: 12 }}>
            <Callout
              tone="danger"
              title="Enregistrement impossible"
              action={
                <Button variant="neutral" size="sm" onClick={() => window.location.reload()}>
                  Recharger le dossier
                </Button>
              }
            >
              {saveMessage}
            </Callout>
          </div>
        )}

        {restore && (
          <div style={{ marginTop: 12 }}>
            <Callout
              tone="warning"
              title="Saisie non enregistrée retrouvée"
              action={
                <div className="mp-row mp-row--wrap">
                  <Button
                    size="sm"
                    onClick={() => {
                      applyData({ ...restore.data, iban: dataRef.current.iban });
                      setRestore(null);
                    }}
                  >
                    Restaurer
                  </Button>
                  <Button
                    size="sm"
                    variant="neutral"
                    onClick={() => {
                      removeBackup(backupKey());
                      setRestore(null);
                    }}
                  >
                    Ignorer
                  </Button>
                </div>
              }
            >
              Des modifications du {formatDateTime(new Date(restore.at))} sont conservées sur cet appareil. (L’IBAN n’est jamais conservé localement.)
            </Callout>
          </div>
        )}

        {isResubmission && initial?.lastAdvMessage && (
          <div style={{ marginTop: 12 }}>
            <Callout tone="warning" title="Complément demandé par l’ADV">
              {initial.lastAdvMessage}
            </Callout>
          </div>
        )}

        <Stepper steps={STEPS} current={step} onSelect={goTo} />

        <div className="mp-wizard-panel">

        {step === 0 && <StepInfo data={data} errors={fieldErrors} onChange={update} onBlur={blur} />}
        {step === 1 && (
          <StepDocuments docs={docs} uploading={uploading} errors={docErrors} onUpload={upload} onRemove={remove} />
        )}
        {step === 2 && (
          <StepReview
            data={data}
            docs={docs}
            check={check}
            confirmed={confirmed}
            onConfirm={setConfirmed}
            goTo={goTo}
            isResubmission={isResubmission}
            reply={reply}
            onReply={setReply}
          />
        )}

        </div>

        {submitError && (
          <div style={{ marginTop: 16 }}>
            <Callout tone="danger" title={submitError} />
          </div>
        )}

        <div className="mp-actionbar">
          {step === 0 && (
            <Button size="lg" block onClick={() => goTo(1)}>
              Continuer
            </Button>
          )}
          {step === 1 && (
            <>
              <Button variant="secondary" size="lg" onClick={() => goTo(0)}>
                Précédent
              </Button>
              <Button size="lg" onClick={() => goTo(2)}>
                Continuer
              </Button>
            </>
          )}
          {step === 2 && (
            <div>
              <Button
                size="lg"
                block
                icon={<Send aria-hidden />}
                onClick={submit}
                loading={submitting}
                disabled={!check.ok || !confirmed || saveState === "conflict"}
              >
                {isResubmission ? "Retransmettre à l’ADV" : "Transmettre à l’ADV"}
              </Button>
              <p className="mp-actionbar__note">
                {!check.ok
                  ? "Complétez les points signalés pour transmettre."
                  : !confirmed
                    ? "Cochez la confirmation pour transmettre."
                    : "Suivez ensuite la validation dans Dossiers."}
              </p>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div className="mp-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
