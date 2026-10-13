import { existsSync, readFileSync } from "node:fs";

/** Charge `.env` pour les scripts CLI (Next.js le fait lui-même pour l'application). */
export function loadEnv(file = ".env"): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const [, key, raw] = m;
    if (key && process.env[key] === undefined) process.env[key] = raw!.replace(/^["']|["']$/g, "");
  }
}
