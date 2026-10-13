"use client";

import { AlertTriangle, CheckCircle2, CloudOff, Loader2, PencilLine } from "lucide-react";
import { formatTime } from "@/domain/dates";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "offline" | "error" | "conflict";

export function SaveIndicator({
  state,
  savedAt,
  message,
  onRetry,
}: {
  state: SaveState;
  savedAt: Date | null;
  message?: string | null;
  onRetry?: () => void;
}) {
  let content: React.ReactNode = null;
  switch (state) {
    case "idle":
      content = savedAt ? (
        <>
          <CheckCircle2 aria-hidden /> Enregistré à {formatTime(savedAt)}
        </>
      ) : (
        <>Brouillon non encore enregistré</>
      );
      break;
    case "dirty":
      content = (
        <>
          <PencilLine aria-hidden /> Modifications en attente d’enregistrement
        </>
      );
      break;
    case "saving":
      content = (
        <>
          <Loader2 aria-hidden className="mp-spin" style={{ animation: "mp-spin 900ms linear infinite" }} /> Enregistrement…
        </>
      );
      break;
    case "saved":
      content = (
        <>
          <CheckCircle2 aria-hidden /> Enregistré à {savedAt ? formatTime(savedAt) : ""}
        </>
      );
      break;
    case "offline":
      content = (
        <>
          <CloudOff aria-hidden /> Hors connexion — saisie conservée sur cet appareil.{" "}
          {onRetry && (
            <button type="button" onClick={onRetry}>
              Réessayer
            </button>
          )}
        </>
      );
      break;
    case "error":
    case "conflict":
      content = (
        <>
          <AlertTriangle aria-hidden /> {message ?? "Échec de l’enregistrement."}{" "}
          {onRetry && state === "error" && (
            <button type="button" onClick={onRetry}>
              Réessayer
            </button>
          )}
        </>
      );
      break;
  }
  const cls = state === "idle" && savedAt ? "saved" : state;
  return (
    <p className={`mp-save mp-save--${cls}`} role="status" aria-live="polite">
      {content}
    </p>
  );
}
