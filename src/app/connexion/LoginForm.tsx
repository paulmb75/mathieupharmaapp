"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/ui/Button";
import { Callout } from "@/ui/Callout";
import { apiFetch, errorMessage } from "@/ui/client/api";

export function LoginForm({ demoAccounts }: { demoAccounts: { email: string; label: string }[] | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await apiFetch("/api/auth/login", { method: "POST", json: { email, password } });
      // Rechargement complet volontaire : repart d'un état client vierge après connexion.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <>
      <form className="mp-form" onSubmit={onSubmit} noValidate style={{ marginTop: 32 }}>
        {error && <Callout tone="danger" title={error} />}
        <div className="mp-field">
          <label htmlFor="email" className="mp-label mp-label--plain">
            Adresse e-mail professionnelle
          </label>
          <div className="mp-input-icon">
            <Mail aria-hidden />
            <input
              id="email"
              className="mp-input mp-input--soft"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="prenom.nom@entreprise.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="mp-field">
          <label htmlFor="password" className="mp-label mp-label--plain">
            Mot de passe
          </label>
          <div className="mp-input-icon">
            <Lock aria-hidden />
            <input
              id="password"
              className="mp-input mp-input--soft"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 52 }}
              required
            />
            <button
              type="button"
              className="mp-iconbtn mp-input-action"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={show}
            >
              {show ? <EyeOff aria-hidden style={{ color: "var(--mp-muted)" }} /> : <Eye aria-hidden style={{ color: "var(--mp-muted)" }} />}
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="mp-textlink" style={{ fontSize: 15 }} onClick={() => setHelp(true)}>
              Mot de passe oublié ?
            </button>
          </div>
        </div>
        <Button type="submit" size="lg" block loading={pending} disabled={!email || !password}>
          Se connecter
        </Button>
      </form>

      <div className="mp-auth__divider">Un problème de connexion ?</div>
      <div style={{ textAlign: "center" }}>
        <button type="button" className="mp-textlink" onClick={() => setHelp(true)} style={{ fontWeight: 600 }}>
          Contacter l’administrateur
        </button>
      </div>
      {help && (
        <div style={{ marginTop: 12 }}>
          <Callout tone="info" title="Réinitialisation de l’accès">
            Votre administrateur peut réinitialiser votre mot de passe ou débloquer votre compte depuis l’espace
            Administration de l’application.
          </Callout>
        </div>
      )}

      {demoAccounts && (
        <div className="mp-demo-accounts">
          <strong>Comptes de démonstration (données fictives)</strong>
          <ul>
            {demoAccounts.map((a) => (
              <li key={a.email}>
                <button type="button" onClick={() => setEmail(a.email)}>
                  {a.label}
                </button>{" "}
                — {a.email}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 8 }}>Mot de passe : valeur de DEMO_PASSWORD dans votre fichier .env.</p>
        </div>
      )}
    </>
  );
}
