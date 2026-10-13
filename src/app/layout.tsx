import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";
import { demoMode } from "@/server/env";

export const metadata: Metadata = {
  title: { default: "Mathieu Pharma", template: "%s · Mathieu Pharma" },
  description: "Application interne Mathieu Pharma",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {demoMode && (
          <div className="mp-demo-banner" role="note">
            Démonstration — données fictives uniquement
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
