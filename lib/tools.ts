import {
  Calculator,
  Code2,
  FileText,
  Image,
  Palette,
  QrCode,
  Type,
  type LucideIcon,
} from "lucide-react";

export type ToolCategory = {
  id: string;
  name: string;
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  colour: Palette,
  typography: Type,
  calculators: Calculator,
  developer: Code2,
  pdf: FileText,
  images: Image,
  other: QrCode,
};

export type Tool = {
  slug: string;
  name: string;
  category: string;
  description: string;
  enabled?: boolean; // false = hidden from nav/routes; re-enable by flipping back
};

export const CATEGORIES: ToolCategory[] = [
  { id: "colour", name: "Colour" },
  { id: "typography", name: "Typography & Text" },
  { id: "calculators", name: "Calculators" },
  { id: "developer", name: "Developer" },
  { id: "pdf", name: "PDF" },
  { id: "images", name: "Images" },
  { id: "other", name: "Other" },
];

export const TOOLS: Tool[] = [
  {
    slug: "colour-converter",
    name: "Colour Converter",
    category: "colour",
    description: "Convert between colour formats",
    enabled: false,
  },
  {
    slug: "contrast-checker",
    name: "Contrast Checker",
    category: "colour",
    description: "Check WCAG colour contrast compliance",
    enabled: false,
  },
  {
    slug: "gradient-generator",
    name: "Gradient Generator",
    category: "colour",
    description: "Create linear and radial gradients",
    enabled: false,
  },
  {
    slug: "tailwind-shades",
    name: "Tailwind Shade Generator",
    category: "colour",
    description: "Generate Tailwind colour scales",
    enabled: false,
  },
  {
    slug: "palette-generator",
    name: "Palette Generator",
    category: "colour",
    description: "Generate beautiful colour palettes",
    enabled: false,
  },
  {
    slug: "word-counter",
    name: "Word Counter",
    category: "typography",
    description: "Count words, characters and more",
    enabled: false,
  },
  {
    slug: "px-to-rem",
    name: "PX to REM",
    category: "typography",
    description: "Convert pixels to rem units",
    enabled: false,
  },
  {
    slug: "line-height-calc",
    name: "Line Height Calculator",
    category: "typography",
    description: "Calculate optimal line heights",
    enabled: false,
  },
  {
    slug: "typo-calc",
    name: "Typography Calculator",
    category: "typography",
    description: "Convert between typographic units",
    enabled: false,
  },
  {
    slug: "paper-sizes",
    name: "Paper Sizes",
    category: "typography",
    description: "Reference for paper dimensions",
    enabled: false,
  },
  {
    slug: "text-diff",
    name: "Text Diff",
    category: "developer",
    description: "Compare two texts and highlight differences",
  },
  {
    slug: "base-converter",
    name: "Base Converter",
    category: "developer",
    description: "Convert between decimal, hex, binary, and octal",
  },
  {
    slug: "unit-converter",
    name: "Unit Converter",
    category: "developer",
    description: "Convert between units of length, weight, data, and more",
  },
  {
    slug: "time-calc",
    name: "Time Calculator",
    category: "developer",
    description: "Unix timestamps, date arithmetic, timezone conversion",
  },
  {
    slug: "encoding-tools",
    name: "Encoding Tools",
    category: "developer",
    description: "Base64, URL encoding, and hash generation",
  },
  {
    slug: "json-formatter",
    name: "JSON Formatter",
    category: "developer",
    description: "Pretty-print, minify, and validate JSON",
  },
  {
    slug: "xml-formatter",
    name: "XML Formatter",
    category: "developer",
    description: "Pretty-print, minify, and validate XML",
  },
  {
    slug: "sql-converter",
    name: "SQL Query Converter",
    category: "developer",
    description: "Convert concatenated C# and VB SQL to parameterized queries",
  },
  {
    slug: "sql-to-code",
    name: "SQL to Code",
    category: "developer",
    description: "Generate legacy VB/C# concatenation code from a SQL query",
  },
  {
    slug: "sql-formatter",
    name: "SQL Formatter",
    category: "developer",
    description: "Pretty-print SQL for SQL Server, Oracle, MySQL, and more",
  },
  {
    slug: "qr-generator",
    name: "QR Generator",
    category: "other",
    description: "Generate styled QR codes with custom colors, shapes, and logos",
  },
  {
    slug: "barcode-generator",
    name: "Barcode Generator",
    category: "other",
    description: "Generate Data Matrix, Aztec, PDF417, Code 128, EAN-13, and more",
  },
  {
    slug: "background-remover",
    name: "Background Remover",
    category: "images",
    description: "Remove backgrounds from images automatically",
  },
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    category: "pdf",
    description: "Combine multiple PDFs into one file",
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    category: "pdf",
    description: "Split a PDF by custom ranges or every N pages",
  },
  {
    slug: "organize-pdf",
    name: "Organize PDF",
    category: "pdf",
    description: "Reorder, rotate and remove pages",
  },
  {
    slug: "extract-pdf-pages",
    name: "Extract PDF Pages",
    category: "pdf",
    description: "Pull selected pages into a new PDF",
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    category: "pdf",
    description: "Reduce PDF file size without uploading anything",
  },
  {
    slug: "watermark-pdf",
    name: "Watermark PDF",
    category: "pdf",
    description: "Stamp text across every page",
  },
  {
    slug: "page-numbers",
    name: "Add Page Numbers",
    category: "pdf",
    description: "Number the pages of a PDF",
  },
  {
    slug: "jpg-to-pdf",
    name: "JPG to PDF",
    category: "images",
    description: "Build a PDF from images",
  },
];

export const ACTIVE_TOOLS = TOOLS.filter((t) => t.enabled !== false);

export const toolsBySlug = new Map(ACTIVE_TOOLS.map((t) => [t.slug, t]));

export const toolsByCategory = (categoryId: string) =>
  ACTIVE_TOOLS.filter((t) => t.category === categoryId);

export const activeCategories = CATEGORIES.filter(
  (c) => toolsByCategory(c.id).length > 0
);
