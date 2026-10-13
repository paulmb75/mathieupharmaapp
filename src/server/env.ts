import "server-only";

export type AppEnv = "development" | "demo" | "production";

function readAppEnv(): AppEnv {
  const v = process.env.APP_ENV ?? "development";
  if (v === "development" || v === "demo" || v === "production") return v;
  throw new Error(`APP_ENV invalide : ${v}`);
}

export const appEnv: AppEnv = readAppEnv();

/** Le mode démo est refusé en production : il ne doit jamais affaiblir les protections. */
export const demoMode: boolean = (() => {
  const enabled = process.env.DEMO_MODE === "true";
  if (enabled && appEnv === "production") {
    throw new Error("DEMO_MODE=true est interdit lorsque APP_ENV=production.");
  }
  return enabled;
})();

export const appUrl = process.env.APP_URL ?? "http://localhost:3000";
export const secureCookies = appUrl.startsWith("https://");

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant (voir .env.example).");
  return url;
}

export const storageDir = process.env.STORAGE_DIR ?? "./storage/documents";
