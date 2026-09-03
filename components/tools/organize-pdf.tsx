"use client";

import { useRef, useState } from "react";
import { AlertCircle, Loader2, RotateCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageGrid, type PageItem } from "@/components/tools/page-grid";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { outputName } from "@/lib/logic/pdf";
import { getPdfLib, loadPdfDoc, pdfBlob } from "@/lib/pdf";
import { ShareButton } from "@/components/tools/share-button";

export default function OrganizePdf() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  // Null = untouched document; edits are an override over the default page list
  const [edits, setEdits] = useState<PageItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Drop stale output when a different document is opened (render-time reset).
  const [prevFile, setPrevFile] = useState<File | null>(null);
  const curFile = state?.file ?? null;
  if (curFile !== prevFile) {
    setPrevFile(curFile);
    setResult(null);
    setError(null);
  }

  const pages: PageItem[] =
    edits ??
    (state
      ? Array.from({ length: state.pageCount }, (_, i) => ({ page: i + 1, rotation: 0 }))
      : []);

  // Apply every pending rotation to the first page that has it queued
  const apply = async () => {
    if (!state || busy || pages.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const src = await loadPdfDoc(await state.file.arrayBuffer());
      const { degrees } = await getPdfLib();
      const out = await (await getPdfLib()).PDFDocument.create();
      const copied = await out.copyPages(src, pages.map((p) => p.page - 1));
      copied.forEach((page, index) => {
        const extra = pages[index].rotation;
        if (extra !== 0) {
          page.setRotation(degrees((page.getRotation().angle + extra) % 360));
        }
        out.addPage(page);
      });
      const bytes = await out.save();
      const blob = pdfBlob(bytes);
      const name = outputName(state.file.name, "-organized");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Organising failed.");
    } finally {
      setBusy(false);
    }
  };

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
                  setEdits(pages.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })))
                }
              >
                <RotateCw className="mr-2 size-4" />
                Rotate all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clear();
                  setEdits(null);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Clear
              </Button>
            </div>
            <div className="p-4">
              <PageGrid mode="organize" pdf={state.pdf} pages={pages} onChange={setEdits} />
              <p className="mt-4 text-xs text-muted-foreground">
                Drag thumbnails to reorder. Hover a page to rotate or remove it.
              </p>
            </div>
            <div className="border-t">
              <Button
                size="lg"
                onClick={apply}
                disabled={busy || pages.length === 0}
                className="h-14 w-full rounded-none text-base font-semibold"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  `Save ${pages.length || ""} page${pages.length === 1 ? "" : "s"}`
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
          <div
            onDrop={(e) => {
              e.preventDefault();
              open(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="m-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                if (e.target.files) open(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <Upload className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="text-lg font-medium">
              {opening ? "Opening…" : "Drop a PDF here"}
            </p>
            {!opening && (
              <p className="mt-1 text-sm text-muted-foreground">
                or click to select a file
              </p>
            )}
          </div>
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
