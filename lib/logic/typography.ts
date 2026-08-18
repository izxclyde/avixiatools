export const DEFAULT_BASE = 16;

export function pxToRem(px: number, base = DEFAULT_BASE): number {
  return px / base;
}

export function remToPx(rem: number, base = DEFAULT_BASE): number {
  return rem * base;
}

export function lineHeightRatio(fontSizePx: number, lineHeightPx: number): number {
  return lineHeightPx / fontSizePx;
}

export function lineHeightPx(fontSizePx: number, ratio: number): number {
  return fontSizePx * ratio;
}

// Typographic units expressed in points (1pt = 1/72"). em/rem depend on the
// base font size (px → pt at 96dpi: 1px = 0.75pt).
export const TYPO_UNITS = ["px", "pt", "pc", "in", "cm", "mm", "agate", "cicero", "em", "rem"] as const;
export type TypoUnit = (typeof TYPO_UNITS)[number];

const PT_PER_UNIT: Record<TypoUnit, number | null> = {
  px: 0.75,
  pt: 1,
  pc: 12,
  in: 72,
  cm: 28.346456692913385,
  mm: 2.8346456692913383,
  agate: 5.5,
  cicero: 12.7875,
  em: null, // base font size in pt
  rem: null, // root font size in pt
};

export function typoToPoints(value: number, unit: TypoUnit, base = DEFAULT_BASE): number {
  const pt = PT_PER_UNIT[unit];
  if (pt !== null) return value * pt;
  return value * base * 0.75; // em/rem
}

export function pointsToTypo(points: number, unit: TypoUnit, base = DEFAULT_BASE): number {
  const pt = PT_PER_UNIT[unit];
  if (pt !== null) return points / pt;
  return points / (base * 0.75);
}

export function convertTypo(
  value: number,
  from: TypoUnit,
  to: TypoUnit,
  base = DEFAULT_BASE
): number {
  return pointsToTypo(typoToPoints(value, from, base), to, base);
}