// Pure OCR geometry helpers for the OCR PDF tool — no DOM or dependency code,
// so they run under node --test.

export type OcrBbox = { x0: number; y0: number; x1: number; y1: number };

export type OcrWord = { text: string; bbox: OcrBbox };

/** How a rendered canvas maps back onto the PDF's user space. */
export type PageGeometry = {
  /** Canvas pixels per PDF point. */
  scale: number;
  /** Crop-box origin in PDF user space (pdf.js `page.view[0..1]`). */
  originX: number;
  originY: number;
  /** Crop-box size in PDF points, unrotated. */
  width: number;
  height: number;
  /** Page /Rotate in degrees clockwise. */
  rotation: number;
};

export type TextPlacement = { x: number; y: number; size: number; rotate: number };

// A page needs a fair amount of text before its own layer is worth trusting —
// one stray artifact from a scan shouldn't suppress OCR for the whole page.
const MIN_EXISTING_TEXT_CHARS = 8;
const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 300;

/** True when a page already carries a usable text layer (so skip re-OCR). */
export function hasTextLayer(text: string): boolean {
  return text.replace(/\s+/g, "").length >= MIN_EXISTING_TEXT_CHARS;
}

/** /Rotate can be any multiple of 90; snap it to the four real values. */
export function normalizeRotation(degrees: number): 0 | 90 | 180 | 270 {
  const snapped = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
  return snapped as 0 | 90 | 180 | 270;
}

/** On-screen page size for a rotation, in points (90/270 swap the axes). */
export function visualSize(
  width: number,
  height: number,
  rotation: number
): { width: number; height: number } {
  const r = normalizeRotation(rotation);
  return r === 90 || r === 270 ? { width: height, height: width } : { width, height };
}

/**
 * Place a tesseract word box (canvas pixels, top-left origin) as text in PDF
 * user space (points, bottom-left origin), undoing the page's /Rotate.
 *
 * The returned `rotate` keeps the glyphs upright on screen: content drawn at
 * angle R in user space appears upright after the page is rotated R° clockwise.
 */
export function bboxToTextPlacement(bbox: OcrBbox, geometry: PageGeometry): TextPlacement {
  const r = normalizeRotation(geometry.rotation);
  const visual = visualSize(geometry.width, geometry.height, r);

  // Canvas pixels → visual points, then flip to a bottom-left origin.
  const vx = bbox.x0 / geometry.scale;
  const vy = visual.height - bbox.y1 / geometry.scale;

  // Visual frame → unrotated user space (inverse of the clockwise rotate).
  let x: number;
  let y: number;
  switch (r) {
    case 90:
      x = geometry.width - vy;
      y = vx;
      break;
    case 180:
      x = geometry.width - vx;
      y = geometry.height - vy;
      break;
    case 270:
      x = vy;
      y = geometry.height - vx;
      break;
    default:
      x = vx;
      y = vy;
  }

  const size = (bbox.y1 - bbox.y0) / geometry.scale;
  return {
    x: x + geometry.originX,
    y: y + geometry.originY,
    size: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size)),
    rotate: r,
  };
}

/**
 * Undo tesseract's `rotateAuto` frame. With auto-rotation on, recognition runs
 * on an image tesseract rotated by `theta` and expanded to fit, so boxes come
 * back in that rotated frame instead of the canvas frame.
 *
 * ponytail: the expansion model and rotation sign can only be confirmed
 * against a real skewed scan, so the UI keeps auto-straighten off by default.
 */
export function unrotateBbox(
  bbox: OcrBbox,
  theta: number,
  canvasWidth: number,
  canvasHeight: number
): OcrBbox {
  if (!theta) return bbox;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rotatedWidth = Math.abs(canvasWidth * cos) + Math.abs(canvasHeight * sin);
  const rotatedHeight = Math.abs(canvasWidth * sin) + Math.abs(canvasHeight * cos);

  const corners: [number, number][] = [
    [bbox.x0, bbox.y0],
    [bbox.x1, bbox.y0],
    [bbox.x0, bbox.y1],
    [bbox.x1, bbox.y1],
  ];

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [cx, cy] of corners) {
    const dx = cx - rotatedWidth / 2;
    const dy = cy - rotatedHeight / 2;
    // inverse of the rotation tesseract applied to the recognised frame
    const ux = dx * cos + dy * sin + canvasWidth / 2;
    const uy = -dx * sin + dy * cos + canvasHeight / 2;
    x0 = Math.min(x0, ux);
    y0 = Math.min(y0, uy);
    x1 = Math.max(x1, ux);
    y1 = Math.max(y1, uy);
  }
  return { x0, y0, x1, y1 };
}

type RawWord = { text?: unknown; bbox?: Record<string, unknown> };
type RawBlock = { paragraphs?: { lines?: { words?: RawWord[] }[] }[] };

/** Flatten tesseract's block tree into word boxes, dropping malformed entries. */
export function collectWords(blocks: unknown): OcrWord[] {
  if (!Array.isArray(blocks)) return [];
  const words: OcrWord[] = [];
  for (const block of blocks as RawBlock[]) {
    for (const paragraph of block?.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) {
        for (const word of line?.words ?? []) {
          const text = typeof word?.text === "string" ? word.text.trim() : "";
          const box = word?.bbox;
          if (!text || !box) continue;
          const nums = [box.x0, box.y0, box.x1, box.y1];
          if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) continue;
          const [x0, y0, x1, y1] = nums as number[];
          if (x1 <= x0 || y1 <= y0) continue;
          words.push({ text, bbox: { x0, y0, x1, y1 } });
        }
      }
    }
  }
  return words;
}
