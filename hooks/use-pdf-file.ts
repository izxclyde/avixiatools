"use client";

import { useCallback, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { openPdfFile } from "@/lib/pdf";
import { checkPageCount, checkPdfFile } from "@/lib/logic/pdf";

export type PdfFileState = {
  file: File;
  pdf: PDFDocumentProxy;
  pageCount: number;
};

// Shared open/clear lifecycle for the single-PDF tools
export function usePdfFile() {
  const [state, setState] = useState<PdfFileState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const open = useCallback(async (incoming: FileList | File[]) => {
    const file = [...incoming].find(
      (f) =>
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf")
    );
    if (!file) {
      setError("Only PDF files are supported.");
      return;
    }
    const tooBig = checkPdfFile(file);
    if (tooBig) {
      setError(tooBig);
      return;
    }
    setError(null);
    setOpening(true);
    try {
      const pdf = await openPdfFile(file);
      const tooLong = checkPageCount(pdf.numPages);
      if (tooLong) {
        setError(tooLong);
        setState(null);
        await pdf.loadingTask.destroy();
        return;
      }
      setState({ file, pdf, pageCount: pdf.numPages });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open this PDF.");
      setState(null);
    } finally {
      setOpening(false);
    }
  }, []);

  const clear = useCallback(() => {
    setState(null);
    setError(null);
  }, []);

  return { state, error, opening, open, clear };
}
