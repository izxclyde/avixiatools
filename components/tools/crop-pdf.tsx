"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { parsePageRanges, outputName } from "@/lib/logic/pdf";
import { getPdfLib, loadPdfDoc, pdfBlob, renderPageToCanvas } from "@/lib/pdf";

type Margins = { top: number; right: number; bottom: number; left: number };

const DEFAULT_MARGINS: Margins = { top: 5, right: 5, bottom: 5, left: 5 };

export default function CropPdf() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [margins, setMargins] = useState<Margins>(DEFAULT_MARGINS);
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drop stale output when a different document is opened (render-time reset).
  const [prevFile, setPrevFile] = useState<File | null>(null);
  const curFile = state?.file ?? null;
  if (curFile !== prevFile) {
    setPrevFile(curFile);
    setResult(null);
    setError(null);
  }

  // First-page preview with a live crop rectangle
  useEffect(() => {
    const host = previewRef.current;
    if (!state || !host) return;
    let cancelled = false;
    host.innerHTML = "";
    (async () => {
      try {
        const page = await state.pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const canvas = await renderPageToCanvas(page, 480);
        if (cancelled) return;
        canvas.className = "block h-auto w-full";
        canvas.style.position = "relative";
        host.appendChild(canvas);

        const overlay = document.createElement("div");
        overlay.style.cssText = [
          "position:absolute",
          "border:2px dashed var(--primary)",
          "background:rgba(0,0,0,0.08)",
          `left:${margins.left}%`,
          `top:${margins.top}%`,
          `right:${margins.right}%`,
          `bottom:${margins.bottom}%`,
        ].join(";");
        host.appendChild(overlay);
      } catch {
        // preview failures are non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, margins]);

  const setMargin = (key: keyof Margins, raw: string) => {
    const value = Math.min(40, Math.max(0, Number(raw) || 0));
    setMargins((prev) => ({ ...prev, [key]: value }));
  };

  const apply = async () => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const indices = range.trim()
        ? (() => {
            const parsed = parsePageRanges(range, state.pageCount);
            if (!parsed) throw new Error(`Invalid page range "${range}".`);
            return parsed;
          })()
        : Array.from({ length: state.pageCount }, (_, i) => i + 1);

      const doc = await loadPdfDoc(await state.file.arrayBuffer());
      for (const pageNum of indices) {
        const page = doc.getPage(pageNum - 1);
        const { width, height } = page.getSize();
        const left = (margins.left / 100) * width;
        const right = (margins.right / 100) * width;
        const top = (margins.top / 100) * height;
        const bottom = (margins.bottom / 100) * height;
        page.setCropBox(left, bottom, Math.max(width - left - right, 1), Math.max(height - top - bottom, 1));
      }

      const bytes = await doc.save();
      const blob = pdfBlob(bytes);
      const name = outputName(state.file.name, "-cropped");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cropping failed.");
    } finally {
      setBusy(false);
    }
  };

  const marginFields: { key: keyof Margins; label: string }[] = [
    { key: "top", label: "Top %" },
    { key: "bottom", label: "Bottom %" },
    { key: "left", label: "Left %" },
    { key: "right", label: "Right %" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        {state ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {state.file.name}
                <span className="text-muted-foreground"> ({state.pageCount} pages)</span>
              </span>
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            </div>

            <div className="grid gap-6 p-4 sm:grid-cols-2">
              <div>
                {/* Relative wrapper keeps the overlay aligned with the canvas */}
                <div className="relative mx-auto max-w-xs border bg-muted p-2">
                  <div ref={previewRef} className="relative" />
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Live crop preview (page 1)
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {marginFields.map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`crop-${key}`}>{label}</Label>
                      <Input
                        id={`crop-${key}`}
                        type="number"
                        min={0}
                        max={40}
                        value={margins[key]}
                        onChange={(e) => setMargin(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="crop-range">Pages (blank = all)</Label>
                  <Input
                    id="crop-range"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    placeholder={`e.g. 2-${state.pageCount}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Margins are percentages of each page&apos;s size, trimming
                  inward from its edges.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t p-4">
              {result && (
                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  Downloaded{" "}
                  <span className="font-medium text-foreground">{result.name}</span>
                </p>
              )}
              <div className="ml-auto flex items-center gap-2">
                <ShareButton
                  blob={result?.blob}
                  filename={result?.name ?? ""}
                  variant="outline"
                  className="font-semibold"
                />
                <Button onClick={apply} disabled={busy} className="font-semibold">
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Cropping…
                    </>
                  ) : (
                    "Crop & download"
                  )}
                </Button>
              </div>
            </div>
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

      <ToolNote>
        Cropping only sets the CropBox — it is reversible and the content bytes
        remain extractable.
      </ToolNote>
    </div>
  );
}
