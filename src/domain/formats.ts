/**
 * Contrôles de FORMAT uniquement.
 *
 * Un format valide ne constitue pas une vérification métier : un SIRET dont la clé
 * est correcte peut appartenir à une autre entreprise, et un IBAN valide ne prouve
 * pas que le compte appartient à la pharmacie. Ces vérifications restent du ressort
 * de l'ADV (et, plus tard, d'intégrations comme Pappers).
 *
 * Les identifiants restent des chaînes de caractères (zéros initiaux préservés).
 */

export function compact(value: string): string {
  return value.replace(/[\s.\-]/g, "");
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function normalizeSiret(value: string): string {
  return compact(value);
}

/** SIRET : 14 chiffres et clé de Luhn (exception connue des établissements de La Poste). */
export function isValidSiret(value: string): boolean {
  const s = normalizeSiret(value);
  if (!/^\d{14}$/.test(s)) return false;
  if (s.startsWith("356000000")) {
    const sum = [...s].reduce((acc, d) => acc + Number(d), 0);
    return sum % 5 === 0;
  }
  return luhnValid(s);
}

export function formatSiret(value: string): string {
  const s = normalizeSiret(value);
  if (!/^\d{14}$/.test(s)) return value;
  return `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6, 9)} ${s.slice(9)}`;
}

export function normalizeIban(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

const IBAN_LENGTHS: Record<string, number> = {
  FR: 27, MC: 27, BE: 16, LU: 20, DE: 22, ES: 24, IT: 27, CH: 21, NL: 18, PT: 25, GB: 22,
};

/** IBAN : structure, longueur par pays connu et clé ISO 13616 (modulo 97). */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of code) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

/** Affichage masqué : « FR76 •••• •••• 0189 ». Ne jamais journaliser l'IBAN complet. */
export function maskIban(value: string | null | undefined): string {
  if (!value) return "";
  const iban = normalizeIban(value);
  if (iban.length < 8) return "••••";
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, "$1 ").trim();
}

export function isValidPostalCode(value: string): boolean {
  return /^\d{5}$/.test(value.trim());
}

export function normalizePhone(value: string): string {
  const c = compact(value).replace(/[()]/g, "");
  if (c.startsWith("+33")) return "0" + c.slice(3);
  if (c.startsWith("0033")) return "0" + c.slice(4);
  return c;
}

/** Numéro français à 10 chiffres (fixe ou mobile, DOM compris). */
export function isValidPhone(value: string): boolean {
  return /^0[1-9]\d{8}$/.test(normalizePhone(value));
}

export function formatPhone(value: string): string {
  const p = normalizePhone(value);
  if (!/^0\d{9}$/.test(p)) return value;
  return p.replace(/(\d{2})(?=\d)/g, "$1 ");
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Code CIP de la pharmacie : 7 chiffres d'après le mockup.
 * PROVISOIRE — format à confirmer avec le formulaire officiel.
 */
export function isValidCip(value: string): boolean {
  return /^\d{7}$/.test(compact(value));
}
