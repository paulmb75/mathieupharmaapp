import Link from "next/link";
import { Logo } from "@/ui/Logo";

export default function NotFound() {
  return (
    <main className="mp-auth">
      <div className="mp-auth__panel" style={{ textAlign: "center", alignItems: "center", gap: 16 }}>
        <Logo height={56} />
        <h1 className="mp-auth__title">Page introuvable</h1>
        <p className="mp-auth__subtitle">Ce dossier n’existe pas ou vous n’y avez pas accès.</p>
        <Link href="/" className="mp-btn mp-btn--primary">
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
