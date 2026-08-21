// Pure barcode logic (adapted from MIT-licensed delphitools source).

export type BarcodeType =
  | "microqr"
  | "datamatrix"
  | "azteccode"
  | "pdf417"
  | "code128"
  | "code39"
  | "ean13"
  | "upca";

export interface BarcodeOptions {
  padding: number;
  foregroundColor: string;
  backgroundColor: string;
  transparentBg: boolean;
  // Toggles bwip-js `includetext` (human-readable digits under 1D codes).
  showText: boolean;
}

// Mod-10 check digit for the EAN/UPC family. `digits` is the data portion
// without the trailing check digit (12 for EAN-13, 11 for UPC-A). The weight
// pair differs per symbology: EAN-13 weights even/odd indices 1/3, UPC-A 3/1.
export const mod10CheckDigit = (
  digits: string,
  evenWeight: number,
  oddWeight: number
): number => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += (digits.charCodeAt(i) - 48) * (i % 2 === 0 ? evenWeight : oddWeight);
  }
  return (10 - (sum % 10)) % 10;
};

export type BarcodeTypeInfo = {
  name: string;
  category: "2d" | "1d";
  charHint: string;
  allowedPattern: RegExp;
  inventor: string;
  year: string;
  description: string;
  placeholder: string;
};

export const BARCODE_TYPES: Record<BarcodeType, BarcodeTypeInfo> = {
  microqr: {
    name: "Micro QR",
    category: "2d",
    charHint: "Letters, numbers, and symbols",
    allowedPattern: /^[\x00-\x7F]*$/,
    inventor: "Denso Wave",
    year: "2004",
    description:
      "Smaller version of QR code for space-constrained applications. Uses only one position detection pattern.",
    placeholder: "Short text or URL",
  },
  datamatrix: {
    name: "Data Matrix",
    category: "2d",
    charHint: "Letters, numbers, and symbols",
    allowedPattern: /^[\x00-\x7F]*$/,
    inventor: "International Data Matrix Inc. (RVSI Acuity CiMatrix)",
    year: "1987",
    description:
      "Used extensively in electronics, healthcare, and logistics. Can encode up to 2,335 alphanumeric characters.",
    placeholder: "Product ID or serial number",
  },
  azteccode: {
    name: "Aztec Code",
    category: "2d",
    charHint: "Letters, numbers, and symbols",
    allowedPattern: /^[\x00-\x7F]*$/,
    inventor: "Andrew Longacre Jr. (Welch Allyn)",
    year: "1995",
    description:
      "Named for resemblance to Aztec pyramids. Used on airline boarding passes and by Deutsche Bahn.",
    placeholder: "Boarding pass or ticket data",
  },
  pdf417: {
    name: "PDF417",
    category: "2d",
    charHint: "Letters, numbers, and symbols",
    allowedPattern: /^[\x00-\x7F]*$/,
    inventor: "Ynjiun Paul Wang (Symbol Technologies)",
    year: "1991",
    description:
      "Portable Data File with 4 bars and spaces in 17 modules. Used on IDs, shipping labels, and boarding passes.",
    placeholder: "ID or license data",
  },
  code128: {
    name: "Code 128",
    category: "1d",
    charHint: "Letters, numbers, and symbols",
    allowedPattern: /^[\x00-\x7F]*$/,
    inventor: "Computer Identics Corporation",
    year: "1981",
    description:
      "High-density barcode for alphanumeric data. Widely used in shipping and packaging industries.",
    placeholder: "ABC-12345",
  },
  code39: {
    name: "Code 39",
    category: "1d",
    charHint: "A-Z (uppercase), 0-9, and - . $ / + % space",
    allowedPattern: /^[A-Z0-9\-. $/+%]*$/,
    inventor: "David Allais & Ray Stevens (Intermec)",
    year: "1974",
    description:
      "One of the first alphanumeric barcodes. Still used in automotive, defense, and healthcare.",
    placeholder: "CODE39TEST",
  },
  ean13: {
    name: "EAN-13",
    category: "1d",
    charHint: "Numbers only (12-13 digits)",
    allowedPattern: /^\d*$/,
    inventor: "George Laurer (IBM), adapted from UPC",
    year: "1976",
    description:
      "European Article Number. Standard barcode for retail products worldwide.",
    placeholder: "5901234123457",
  },
  upca: {
    name: "UPC-A",
    category: "1d",
    charHint: "Numbers only (11-12 digits)",
    allowedPattern: /^\d*$/,
    inventor: "George Laurer (IBM)",
    year: "1973",
    description:
      "Universal Product Code. The original retail barcode, still dominant in North America.",
    placeholder: "012345678905",
  },
};

export const isContentCompatible = (
  content: string,
  type: BarcodeType
): boolean => BARCODE_TYPES[type].allowedPattern.test(content);

// Filter content to only allowed characters; Code 39 auto-uppercases.
export const filterContent = (content: string, type: BarcodeType): string => {
  if (type === "code39") content = content.toUpperCase();
  const pattern = BARCODE_TYPES[type].allowedPattern;
  return content
    .split("")
    .filter((char) => pattern.test(char))
    .join("");
};

// Returns a human-readable error, or null when the value is valid.
// EAN-13/UPC-A accept the data portion alone (auto check digit at render)
// or a full code whose check digit must match.
export const validateContent = (
  content: string,
  type: BarcodeType
): string | null => {
  if (type === "code39" && !BARCODE_TYPES.code39.allowedPattern.test(content)) {
    return "Code 39 only supports: A-Z (uppercase), 0-9, - . $ / + % and space";
  }
  if (type === "ean13" && content.length > 0) {
    if (!/^\d{12,13}$/.test(content)) {
      return "EAN-13 requires exactly 12 or 13 digits";
    }
    if (content.length === 13) {
      const expected = mod10CheckDigit(content.slice(0, 12), 1, 3);
      if (content.charCodeAt(12) - 48 !== expected) {
        return `Check digit should be ${expected} — or enter just the first 12 digits to auto-fill it`;
      }
    }
  }
  if (type === "upca" && content.length > 0) {
    if (!/^\d{11,12}$/.test(content)) {
      return "UPC-A requires exactly 11 or 12 digits";
    }
    if (content.length === 12) {
      const expected = mod10CheckDigit(content.slice(0, 11), 3, 1);
      if (content.charCodeAt(11) - 48 !== expected) {
        return `Check digit should be ${expected} — or enter just the first 11 digits to auto-fill it`;
      }
    }
  }
  return null;
};

// bwip-js bcid for each type.
const BWIP_TYPE_MAP: Record<BarcodeType, string> = {
  microqr: "microqrcode",
  datamatrix: "datamatrix",
  azteccode: "azteccode",
  pdf417: "pdf417",
  code128: "code128",
  code39: "code39",
  ean13: "ean13",
  upca: "upca",
};

// Builds the bwip-js options for a render; shared by single, batch, PNG and
// SVG so includetext/transparency/colours can never diverge between paths.
// Transparency relies on OMITTING backgroundcolor: bwip-js only paints a
// background when the value is a valid colour, otherwise it clears to alpha-0.
export const buildBwipOptions = (
  type: BarcodeType,
  text: string,
  size: number,
  options: BarcodeOptions
) => {
  const is1D = BARCODE_TYPES[type].category === "1d";
  return {
    bcid: BWIP_TYPE_MAP[type],
    text,
    scale: is1D ? 3 : Math.max(2, Math.floor(size / 100)),
    includetext: is1D && options.showText,
    textxalign: "center" as const,
    paddingwidth: options.padding * 2,
    paddingheight: options.padding * 2,
    barcolor: options.foregroundColor.replace("#", ""),
    ...(options.transparentBg
      ? {}
      : { backgroundcolor: options.backgroundColor.replace("#", "") }),
    ...(type === "pdf417" ? { height: 10 } : is1D ? { height: 15 } : {}),
  };
};

// bwip-js raises errors as "bwipp.someCode#1234: message" or "bwip-js: message".
// Strip the namespace so users see the human-readable part only.
export const friendlyBwipError = (err: unknown): string => {
  const raw =
    err instanceof Error ? err.message : "Failed to generate barcode";
  return raw.replace(/^(bwipp\.[^:]*|bwip-js):\s*/, "");
};
