// Pure helpers shared by the PDF tools — no DOM or dependency code, so they run in node --test.

/** Parse a single range token like "3" or "2-5" (clamped to maxPage). Null when invalid/empty. */
export function parseRangeSegment(segment: string, maxPage: number): number[] | null {
  const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(segment.trim());
  if (!match || maxPage < 1) return null;
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (start < 1 || end < start) return null;
  const pages: number[] = [];
  for (let p = start; p <= Math.min(end, maxPage); p++) pages.push(p);
  return pages.length > 0 ? pages : null;
}

/**
 * Parse "1-3,5" into a sorted, unique, 1-based page list clamped to maxPage.
 * Returns null when the whole input is empty or any part is malformed.
 */
export function parsePageRanges(input: string, maxPage: number): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const pages = new Set<number>();
  for (const part of trimmed.split(",")) {
    if (!part.trim()) continue;
    const parsed = parseRangeSegment(part, maxPage);
    if (!parsed) return null;
    parsed.forEach((p) => pages.add(p));
  }
  return pages.size > 0 ? [...pages].sort((a, b) => a - b) : null;
}

/** Split an ordered list into consecutive chunks of at most `size`. */
export function chunkPages<T>(items: T[], size: number): T[][] {
  if (size < 1) size = 1;
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Replace {n} and {total} placeholders in a page-number template. */
export function formatPageLabel(template: string, n: number, total: number): string {
  return template.replaceAll("{n}", String(n)).replaceAll("{total}", String(total));
}

/** "scan.pdf" + "-compressed" → "scan-compressed.pdf"; appends .pdf when missing. */
export function outputName(original: string, suffix: string): string {
  const base = original.replace(/\.pdf$/i, "");
  return `${base}${suffix}.pdf`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Characters outside WinAnsi throw when drawn with pdf-lib standard fonts,
// so map anything unrepresentable to "?" before drawing.
const WIN_ANSI_EXTRA = new Set(
  [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
    0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
    0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
  ].map((code) => String.fromCodePoint(code))
);

export function sanitizeWinAnsi(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0)!;
    out += code <= 0xff || WIN_ANSI_EXTRA.has(char) ? char : "?";
  }
  return out;
}
