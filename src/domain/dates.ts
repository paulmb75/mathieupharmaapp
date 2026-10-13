const TZ = "Europe/Paris";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "short" });

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

export function formatDate(value: Date | string): string {
  return dateFmt.format(toDate(value));
}

export function formatTime(value: Date | string): string {
  return timeFmt.format(toDate(value));
}

export function formatDateTime(value: Date | string): string {
  return `${formatDate(value)} à ${formatTime(value)}`;
}

function dayKey(d: Date): string {
  return dateFmt.format(d);
}

/** « Aujourd'hui à 14:03 », « Hier à 09:12 », « 3 oct. à 11:00 ». */
export function formatRelative(value: Date | string, now: Date = new Date()): string {
  const d = toDate(value);
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  if (dayKey(d) === dayKey(now)) return `Aujourd’hui à ${formatTime(d)}`;
  if (dayKey(d) === dayKey(yesterday)) return `Hier à ${formatTime(d)}`;
  return `${shortFmt.format(d)} à ${formatTime(d)}`;
}
