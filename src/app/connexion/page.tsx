import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getCurrentUser } from "@/server/auth/current";
import { demoMode } from "@/server/env";
import { Logo } from "@/ui/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion" };

const DEMO_ACCOUNTS = [
  { email: "paul.martin@demo.mathieu-pharma.test", label: "Commercial — Paul Martin" },
  { email: "claire.adv@demo.mathieu-pharma.test", label: "ADV — Claire Bernard" },
  { email: "admin@demo.mathieu-pharma.test", label: "Administrateur" },
];

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mp-auth">
      <div className="mp-auth__panel">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo height={64} />
        </div>
        <h1 className="mp-auth__title">Bienvenue</h1>
        <p className="mp-auth__subtitle">Connectez-vous à votre espace professionnel</p>
        <LoginForm demoAccounts={demoMode ? DEMO_ACCOUNTS : null} />
        <p className="mp-auth__footer">
          <Lock aria-hidden /> Accès réservé aux collaborateurs
        </p>
      </div>
    </main>
  );
}
