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

export type EpochPrecision = "s" | "ms" | "us" | "ns";

const EPOCH_SCALE: Record<EpochPrecision, number> = {
  s: 1,
  ms: 1e3,
  us: 1e6,
  ns: 1e9,
};

// Heuristic by integer-digit count: ≤10 → seconds, 11-13 → ms, 14-16 → µs, ≥17 → ns.
export function detectEpochPrecision(value: string): EpochPrecision {
  const digits = value.replace(/^-/, "").split(".")[0].length;
  if (digits <= 10) return "s";
  if (digits <= 13) return "ms";
  if (digits <= 16) return "us";
  return "ns";
}

export function epochToSeconds(value: string): number | null {
  const clean = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean) / EPOCH_SCALE[detectEpochPrecision(clean)];
}

export function epochPrecisions(date: Date): Record<EpochPrecision, string> {
  const ms = date.getTime();
  return {
    s: String(Math.floor(ms / 1000)),
    ms: String(ms),
    us: String(Math.round(ms * 1e3)),
    ns: String(Math.round(ms * 1e6)),
  };
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