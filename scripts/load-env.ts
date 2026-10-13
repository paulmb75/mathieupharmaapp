import { existsSync, readFileSync } from "node:fs";

/**
 * Charge `.env` pour les scripts CLI (Next.js le fait lui-même pour l'application).
 * Tolère les espaces superflus et les guillemets droits ou typographiques ajoutés
 * par certains éditeurs (TextEdit sur Mac, par exemple).
 */
export function loadEnv(file = ".env"): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    const value = m[2]!
      .replace(/[  ]/g, " ")
      .trim()
      .replace(/^["'“”«»]\s*|\s*["'“”«»]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
