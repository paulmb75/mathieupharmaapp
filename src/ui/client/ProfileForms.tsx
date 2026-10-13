"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "../Button";
import { Callout } from "../Callout";
import { Field, TextInput } from "../Field";
import { apiFetch, errorMessage } from "./api";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="neutral"
      block
      icon={<LogOut aria-hidden />}
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          await apiFetch("/api/auth/logout", { method: "POST" });
        } finally {
          // Rechargement complet volontaire : vide le cache du routeur (pages déjà consultées).
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/connexion");
        }
      }}
    >
      Se déconnecter
    </Button>
  );
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setResult({ ok: false, message: "Les deux saisies du nouveau mot de passe diffèrent." });
    setPending(true);
    setResult(null);
    try {
      await apiFetch("/api/profile/password", { method: "POST", json: { currentPassword: current, newPassword: next } });
      setResult({ ok: true, message: "Mot de passe modifié." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setResult({ ok: false, message: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mp-form" onSubmit={submit}>
      {result && <Callout tone={result.ok ? "success" : "danger"} title={result.message} />}
      <Field id="current" label="Mot de passe actuel" plainLabel>
        <TextInput id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field id="next" label="Nouveau mot de passe" plainLabel hint="12 caractères minimum.">
        <TextInput id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={12} required />
      </Field>
      <Field id="confirm" label="Confirmer le nouveau mot de passe" plainLabel>
        <TextInput id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" loading={pending} disabled={!current || !next || !confirm}>
        Modifier le mot de passe
      </Button>
    </form>
  );
}
