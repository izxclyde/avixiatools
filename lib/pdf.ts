// Client-side PDF helpers. Everything here runs in the browser only — tools
// dynamically import this module so pdf.js (~1MB) stays out of other pages.

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const { getDocument } = await getPdfjs();
  try {
    return await getDocument({ data: new Uint8Array(data) }).promise;
  } catch (error) {
    const name = (error as { name?: string }).name ?? "";
    if (name === "PasswordException") {
      throw new Error("This PDF is password-protected and can't be opened here.");
    }
    if (name === "InvalidPDFException") {
      throw new Error("This file doesn't look like a valid PDF.");
    }
    throw error;
  }
}

/** Read the file and open it, mapping common failure modes to friendly messages. */
export async function openPdfFile(file: File): Promise<PDFDocumentProxy> {
  return openPdf(await file.arrayBuffer());
}

/** Open a possibly-encrypted PDF with a known password (unlock tool). */
export async function openEncryptedPdf(
  data: ArrayBuffer,
  password: string
): Promise<PDFDocumentProxy> {
  const { getDocument } = await getPdfjs();
  try {
    return await getDocument({ data: new Uint8Array(data), password }).promise;
  } catch (error) {
    const name = (error as { name?: string }).name ?? "";
    if (name === "PasswordException") {
      throw new Error("Wrong or missing password.");
    }
    throw error;
  }
}

type PdfMakeModule = (typeof import("pdfmake/build/pdfmake"))["default"];

let pdfMakePromise: Promise<PdfMakeModule> | null = null;

// pdfmake needs its font bundle registered before creating documents.
export async function getPdfMake(): Promise<PdfMakeModule> {
  if (!pdfMakePromise) {
    pdfMakePromise = (async () => {
      const pdfMake = (await import("pdfmake/build/pdfmake")).default;
      const vfs = (await import("pdfmake/build/vfs_fonts")).default;
      pdfMake.addVirtualFileSystem(vfs);
      return pdfMake;
    })();
  }
  return pdfMakePromise;
}

type PdfLibModule = typeof import("@cantoo/pdf-lib");

let pdfLibPromise: Promise<PdfLibModule> | null = null;

// @cantoo/pdf-lib is a drop-in fork of pdf-lib that adds AES encryption
// support (protect/unlock) while keeping the same public API.
export async function getPdfLib(): Promise<PdfLibModule> {
  if (!pdfLibPromise) pdfLibPromise = import("@cantoo/pdf-lib");
  return pdfLibPromise;
}

/** Load a PDF with pdf-lib, mapping encryption failures to a friendly message. */
export async function loadPdfDoc(data: ArrayBuffer) {
  const { PDFDocument } = await getPdfLib();
  try {
    return await PDFDocument.load(data);
  } catch (error) {
    if (/encrypt/i.test(String((error as Error)?.message))) {
      throw new Error("This PDF is password-protected and can't be modified here.");
    }
    throw error;
  }
}

export async function createPdfDoc() {
  const { PDFDocument } = await getPdfLib();
  return PDFDocument.create();
}

/** pdf-lib save() output as a download-ready Blob. */
export function pdfBlob(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}

/** Render one page into an offscreen canvas at the given CSS-pixel width. */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  targetWidth: number
): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext("2d")!;
  // pdfjs v6 requires the canvas itself in render params
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      type,
      quality
    );
  });
}

/**
 * Extract a page's text as visual lines: items grouped by baseline Y
 * (±2pt tolerance), ordered top-to-bottom, joined left-to-right.
 * Used by the Word/Excel converters — layout beyond line order is lost.
 */
export async function extractPageLines(
  pdf: PDFDocumentProxy,
  pageNum: number
): Promise<string[]> {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];

  for (const item of content.items) {
    if (!("str" in item) || !item.str?.trim()) continue;
    const transform = item.transform ?? [1, 0, 0, 1, 0, 0];
    const y = Math.round(transform[5] * 2) / 2; // half-point buckets
    let line = lines.find((l) => Math.abs(l.y - y) < 2);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x: transform[4], str: item.str });
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

/**
 * Return image bytes pdf-lib can embed: pass-through for JPEG/PNG,
 * canvas re-encode for anything else (WebP, GIF, …).
 */
export async function imageFileToEmbeddable(file: File): Promise<{ data: Uint8Array; type: "jpg" | "png" }> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (file.type === "image/jpeg" || file.type === "image/png") {
    return { data: buffer, type: file.type === "image/jpeg" ? "jpg" : "png" };
  }
  const bitmap = await createImageBitmap(new Blob([buffer], { type: file.type }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvasToBlob(canvas, "image/png");
  return { data: new Uint8Array(await blob.arrayBuffer()), type: "png" };
}
