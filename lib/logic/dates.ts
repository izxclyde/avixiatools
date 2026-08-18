export function unixToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

export function dateToUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function nowUnix(): number {
  return dateToUnix(new Date());
}

export function formatUnix(seconds: number): string | null {
  if (!Number.isFinite(seconds)) return null;
  const date = unixToDate(seconds);
  return isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function addToDate(
  date: Date,
  delta: { days?: number; months?: number; years?: number }
): Date {
  const out = new Date(date);
  if (delta.years) out.setFullYear(out.getFullYear() + delta.years);
  if (delta.months) {
    const day = out.getDate();
    out.setMonth(out.getMonth() + delta.months);
    if (out.getDate() !== day) out.setDate(0);
  }
  if (delta.days) out.setDate(out.getDate() + delta.days);
  return out;
}

export function weekdayName(date: Date, locale = "en-US"): string {
  return date.toLocaleDateString(locale, { weekday: "long" });
}

export function dateDiffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "long",
  }).format(date);
}

export function timezoneOffset(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  return name.replace(/^GMT/, "UTC");
}