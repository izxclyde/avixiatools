import {
  parse,
  formatHex,
  formatRgb,
  formatHsl,
  formatCss,
  converter,
  interpolate,
  wcagContrast,
  wcagLuminance,
} from "culori";

export type ColourFormats = {
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
  lab: string;
  lch: string;
  oklab: string;
};

const FORMATS = [
  "hex",
  "rgb",
  "hsl",
  "oklch",
  "lab",
  "lch",
  "oklab",
] as const;
export type ColourFormat = (typeof FORMATS)[number];
export const COLOUR_FORMATS: ColourFormat[] = [...FORMATS];

export function parseColour(input: string): ColourFormats | null {
  let colour: ReturnType<typeof parse>;
  try {
    colour = parse(input.trim());
  } catch {
    return null;
  }
  if (!colour) return null;

  const mode = (m: ColourFormat) => formatCss(converter(m as Parameters<typeof converter>[0])(colour));
  return {
    hex: formatHex(colour),
    rgb: formatRgb(colour),
    hsl: formatHsl(colour),
    oklch: mode("oklch"),
    lab: mode("lab"),
    lch: mode("lch"),
    oklab: mode("oklab"),
  };
}

export function contrastRatio(fg: string, bg: string): number | null {
  try {
    const fgColour = parse(fg);
    const bgColour = parse(bg);
    if (!fgColour || !bgColour) return null;
    return wcagContrast(fgColour, bgColour);
  } catch {
    return null;
  }
}

export function luminance(colour: string): number | null {
  try {
    const c = parse(colour);
    if (!c) return null;
    return wcagLuminance(c);
  } catch {
    return null;
  }
}

// Tailwind-style shade scale (v4 interpolation in OKLCH), mirroring the
// classic approach of mixing the base colour toward white (50) and black (950).
const SHADE_WEIGHTS: Record<string, number> = {
  "50": 0.85,
  "100": 0.7,
  "200": 0.5,
  "300": 0.3,
  "400": 0.15,
  "500": 0,
  "600": -0.15,
  "700": -0.3,
  "800": -0.5,
  "900": -0.7,
  "950": -0.85,
};

export const SHADE_STEPS = Object.keys(SHADE_WEIGHTS);

export function generateShades(hex: string): Record<string, string> {
  const base = parse(hex);
  if (!base) return {};
  const toWhite = interpolate([base, "white"], "oklch");
  const toBlack = interpolate([base, "black"], "oklch");
  const shades: Record<string, string> = {};
  for (const step of SHADE_STEPS) {
    const weight = SHADE_WEIGHTS[step];
    const mixed = weight === 0 ? base : weight > 0 ? toWhite(weight) : toBlack(-weight);
    shades[step] = formatHex(mixed);
  }
  return shades;
}

// Builds a 5-colour harmony around a random hue: base + analogous offsets.
export function generatePalette(): string[] {
  const h = Math.floor(Math.random() * 360);
  const hues = [0, 30, -30, 60, 150].map((d) => (h + d + 360) % 360);
  const toHex = converter("rgb");
  const build = (hue: number, index: number) => {
    const lightness = index % 2 === 0 ? 0.62 : 0.45;
    const saturation = index < 3 ? 0.75 : 0.5;
    return formatHex(
      toHex({ mode: "hsl", h: hue, s: saturation, l: lightness })
    );
  };
  return hues.map(build);
}

export function randomColour(): string {
  const c = converter("rgb");
  return formatHex(c({ mode: "oklch", l: Math.random() * 0.5 + 0.4, c: Math.random() * 0.15 + 0.05, h: Math.random() * 360 }));
}
