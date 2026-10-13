import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Développement uniquement : autorise un téléphone du même réseau local à charger
 * l'application via l'adresse IP de cet ordinateur (Next.js bloque sinon ses scripts
 * de développement pour toute autre origine que localhost). Sans effet en production.
 */
function localNetworkHosts(): string[] {
  const hosts = Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  return [...hosts, "*.local"];
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: localNetworkHosts(),
  serverExternalPackages: ["pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
