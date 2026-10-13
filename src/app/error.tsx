"use client";

import { Button } from "@/ui/Button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mp-auth">
      <div className="mp-auth__panel" style={{ textAlign: "center", alignItems: "center", gap: 16 }}>
        <h1 className="mp-auth__title">Une erreur est survenue</h1>
        <p className="mp-auth__subtitle">Vos saisies enregistrées sont conservées. Réessayez dans un instant.</p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </main>
  );
}
