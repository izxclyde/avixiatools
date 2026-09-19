"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { PageGrid } from "@/components/tools/page-grid";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { outputName } from "@/lib/logic/pdf";
import { getPdfLib, loadPdfDoc, pdfBlob } from "@/lib/pdf";
import { ShareButton } from "@/components/tools/share-button";

export default function ExtractPdfPages() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  // Drop stale output when a different document is opened (render-time reset).
  const [prevFile, setPrevFile] = useState<File | null>(null);
  const curFile = state?.file ?? null;
  if (curFile !== prevFile) {
    setPrevFile(curFile);
    setResult(null);
    setError(null);
  }

  const toggle = (page: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  };

  const extract = async () => {
    if (!state || selected.size === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const src = await loadPdfDoc(await state.file.arrayBuffer());
      const out = await (await getPdfLib()).PDFDocument.create();
      const indices = [...selected].sort((a, b) => a - b).map((p) => p - 1);
      const pages = await out.copyPages(src, indices);
      pages.forEach((page) => out.addPage(page));
      const bytes = await out.save();
      const blob = pdfBlob(bytes);
      const name = outputName(state.file.name, "-extracted");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  };

  const showFilePicker = !state && (
    <Dropzone
      accept="application/pdf,.pdf"
      onFiles={open}
      title={opening ? "Opening…" : "Drop a PDF here"}
      subtitle={opening ? undefined : "or click to select a file"}
      disabled={opening}
    />
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        {state ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {state.file.name}{" "}
                <span className="text-muted-foreground">({state.pageCount} pages)</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelected(
                    selected.size === state.pageCount
                      ? new Set()
                      : new Set(Array.from({ length: state.pageCount }, (_, i) => i + 1))
                  )
                }
              >
                {selected.size === state.pageCount ? "Deselect all" : "Select all"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { clear(); setSelected(new Set()); }}>
                Clear
              </Button>
            </div>
            <div className="p-4">
              <PageGrid
                mode="select"
                pdf={state.pdf}
                pageCount={state.pageCount}
                selected={selected}
                onToggle={toggle}
              />
            </div>
            <div className="border-t">
              <Button
                size="lg"
                onClick={extract}
                disabled={busy || selected.size === 0}
                className="h-14 w-full rounded-none text-base font-semibold"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Extracting…
                  </>
                ) : (
                  `Extract ${selected.size || ""} page${selected.size === 1 ? "" : "s"}`
                )}
              </Button>
            </div>
            {result && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  Downloaded:{" "}
                  <span className="font-medium text-foreground">{result.name}</span>
                </p>
                <ShareButton blob={result.blob} filename={result.name} />
              </div>
            )}
          </>
        ) : (
          showFilePicker
        )}
      </div>

      {(openError ?? error) && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{openError ?? error}</p>
        </div>
      )}
    </div>
  );
}
