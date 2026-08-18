export type ToolCategory = {
  id: string;
  name: string;
};

export type Tool = {
  slug: string;
  name: string;
  category: string;
  description: string;
};

export const CATEGORIES: ToolCategory[] = [
  { id: "colour", name: "Colour" },
  { id: "typography", name: "Typography & Text" },
  { id: "calculators", name: "Calculators" },
];

export const TOOLS: Tool[] = [
  {
    slug: "colour-converter",
    name: "Colour Converter",
    category: "colour",
    description: "Convert between colour formats",
  },
  {
    slug: "contrast-checker",
    name: "Contrast Checker",
    category: "colour",
    description: "Check WCAG colour contrast compliance",
  },
  {
    slug: "gradient-generator",
    name: "Gradient Generator",
    category: "colour",
    description: "Create linear and radial gradients",
  },
  {
    slug: "tailwind-shades",
    name: "Tailwind Shade Generator",
    category: "colour",
    description: "Generate Tailwind colour scales",
  },
  {
    slug: "palette-generator",
    name: "Palette Generator",
    category: "colour",
    description: "Generate beautiful colour palettes",
  },
  {
    slug: "word-counter",
    name: "Word Counter",
    category: "typography",
    description: "Count words, characters and more",
  },
  {
    slug: "px-to-rem",
    name: "PX to REM",
    category: "typography",
    description: "Convert pixels to rem units",
  },
  {
    slug: "line-height-calc",
    name: "Line Height Calculator",
    category: "typography",
    description: "Calculate optimal line heights",
  },
  {
    slug: "typo-calc",
    name: "Typography Calculator",
    category: "typography",
    description: "Convert between typographic units",
  },
  {
    slug: "paper-sizes",
    name: "Paper Sizes",
    category: "typography",
    description: "Reference for paper dimensions",
  },
  {
    slug: "text-diff",
    name: "Text Diff",
    category: "typography",
    description: "Compare two texts and highlight differences",
  },
  {
    slug: "base-converter",
    name: "Base Converter",
    category: "calculators",
    description: "Convert between decimal, hex, binary, and octal",
  },
  {
    slug: "unit-converter",
    name: "Unit Converter",
    category: "calculators",
    description: "Convert between units of length, weight, data, and more",
  },
  {
    slug: "time-calc",
    name: "Time Calculator",
    category: "calculators",
    description: "Unix timestamps, date arithmetic, timezone conversion",
  },
  {
    slug: "encoding-tools",
    name: "Encoding Tools",
    category: "calculators",
    description: "Base64, URL encoding, and hash generation",
  },
];

export const toolsBySlug = new Map(TOOLS.map((t) => [t.slug, t]));

export const toolsByCategory = (categoryId: string) =>
  TOOLS.filter((t) => t.category === categoryId);
