"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  SquareDashed,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { outputName } from "@/lib/logic/pdf";
import { canvasToBlob, getPdfLib, loadPdfDoc, pdfBlob, renderPageToCanvas } from "@/lib/pdf";

type Rect = { x0: number; y0: number; x1: number; y1: number }; // fractions of page

export default function RedactPdf() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [pageNum, setPageNum] = useState(1);
  const [marks, setMarks] = useState<Record<number, Rect[]>>({});
  const [drag, setDrag] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null); // wraps preview + overlays; captures drags
  const canvasHostRef = useRef<HTMLDivElement>(null); // canvas host — React never touches its children
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  // Drop per-file work when a different document is opened (render-time reset).
  const [prevFile, setPrevFile] = useState<File | null>(null);
  const curFile = state?.file ?? null;
  if (curFile !== prevFile) {
    setPrevFile(curFile);
    setMarks({});
    setPageNum(1);
    setResult(null);
    setError(null);
  }

  // Render the current page preview into the dedicated host node
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!state || !host) return;
    let cancelled = false;
    host.innerHTML = "";
    (async () => {
      try {
        const page = await state.pdf.getPage(pageNum);
        const canvas = await renderPageToCanvas(page, 560);
        if (cancelled) return;
        canvas.className = "block h-auto w-full select-none";
        host.appendChild(canvas);
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, pageNum]);

  /** Fractions of the preview canvas under the pointer. */
  const frac = useCallback((e: React.PointerEvent) => {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }, []);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = frac(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    originRef.current = p;
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!originRef.current) return;
    const p = frac(e);
    if (!p) return;
    setDrag({ x0: originRef.current.x, y0: originRef.current.y, x1: p.x, y1: p.y });
  };

  const endDrag = () => {
    if (!drag) return;
    const rect: Rect = {
      x0: Math.min(drag.x0, drag.x1),
      y0: Math.min(drag.y0, drag.y1),
      x1: Math.max(drag.x0, drag.x1),
      y1: Math.max(drag.y0, drag.y1),
    };
    originRef.current = null;
    setDrag(null);
    if ((rect.x1 - rect.x0) * (rect.y1 - rect.y0) < 0.0004) return; // ignore clicks
    setMarks((prev) => ({ ...prev, [pageNum]: [...(prev[pageNum] ?? []), rect] }));
    setResult(null);
  };

  const totalMarks = Object.values(marks).reduce((sum, list) => sum + list.length, 0);

  const apply = async () => {
    if (!state || busy || totalMarks === 0) return;
    setBusy(true);
    cancelRef.current = false;
    setError(null);
    try {
      const lib = await getPdfLib();
      const src = await loadPdfDoc(await state.file.arrayBuffer());
      const out = await lib.PDFDocument.create();

      for (let i = 1; i <= state.pageCount; i++) {
        if (cancelRef.current) {
          setError("Cancelled — no file was downloaded.");
          return;
        }
        const rects = marks[i] ?? [];
        if (rects.length === 0) {
          // Untouched pages are copied losslessly
          const [copied] = await out.copyPages(src, [i - 1]);
          out.addPage(copied);
          continue;
        }
        setProgress(`Redacting page ${i} of ${state.pageCount}…`);
        // Render the page, burn black boxes into the pixels, embed as an image.
        // Rasterising destroys any text hidden underneath the boxes.
        const pageProxy = await state.pdf.getPage(i);
        const base = pageProxy.getViewport({ scale: 1 });
        const canvas = await renderPageToCanvas(pageProxy, Math.min(base.width * 1.5, 3000));
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#000";
        for (const r of rects) {
          ctx.fillRect(
            r.x0 * canvas.width,
            r.y0 * canvas.height,
            (r.x1 - r.x0) * canvas.width,
            (r.y1 - r.y0) * canvas.height
          );
        }
        const image = await out.embedJpg(
          new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.9)).arrayBuffer())
        );
        const newPage = out.addPage([base.width, base.height]);
        newPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
      }

      const bytes = await out.save();
      const blob = pdfBlob(bytes);
      const name = outputName(state.file.name, "-redacted");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redaction failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

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
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum === 1}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-16 text-center text-sm text-muted-foreground">
                  {pageNum} / {state.pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNum((p) => Math.min(state.pageCount, p + 1))}
                  disabled={pageNum === state.pageCount}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            </div>

            <div className="p-4">
              <div
                ref={stageRef}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                className="relative mx-auto max-w-md touch-none overflow-hidden rounded-md border bg-muted p-2"
              >
                {/* Canvas lives in its own untouched node; overlays are React siblings */}
                <div ref={canvasHostRef} />
                {(marks[pageNum] ?? []).map((r, index) => (
                  <span
                    key={`${pageNum}-${index}`}
                    aria-label={`Redaction box ${index + 1}`}
                    className="pointer-events-none absolute z-10 border border-black bg-black"
                    style={{
                      left: `calc(${(r.x0 * 100).toFixed(2)}% + 0.5rem)`,
                      top: `calc(${(r.y0 * 100).toFixed(2)}% + 0.5rem)`,
                      width: `${((r.x1 - r.x0) * 100).toFixed(2)}%`,
                      height: `${((r.y1 - r.y0) * 100).toFixed(2)}%`,
                    }}
                  />
                ))}
                {drag && (
                  <span
                    className="pointer-events-none absolute z-10 border border-black bg-black/80"
                    style={{
                      left: `calc(${Math.min(drag.x0, drag.x1) * 100}% + 0.5rem)`,
                      top: `calc(${Math.min(drag.y0, drag.y1) * 100}% + 0.5rem)`,
                      width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
                      height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
                    }}
                  />
                )}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Drag boxes over everything that must disappear —{" "}
                {totalMarks} box{totalMarks === 1 ? "" : "es"} across{" "}
                {Object.keys(marks).length} page{Object.keys(marks).length === 1 ? "" : "s"}
                {(marks[pageNum] ?? []).length > 0 && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-foreground"
                      onClick={() =>
                        setMarks((prev) => {
                          const next = { ...prev };
                          delete next[pageNum];
                          return next;
                        })
                      }
                    >
                      clear this page
                    </button>
                  </>
                )}
              </p>
            </div>

            {progress && (
              <div className="flex items-center gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {progress}
              </div>
            )}

            <div className="flex items-center justify-between gap-4 border-t p-4">
              {result && (
                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  Downloaded{" "}
                  <span className="font-medium text-foreground">{result.name}</span>
                </p>
              )}
              <div className="ml-auto flex items-center gap-2">
                {busy && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <ShareButton
                  blob={result?.blob}
                  filename={result?.name ?? ""}
                  variant="outline"
                  className="font-semibold"
                />
                <Button
                  size="lg"
                  onClick={apply}
                  disabled={busy || totalMarks === 0}
                  className="font-semibold"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Working…
                    </>
                  ) : (
                    <>
                      <SquareDashed className="mr-2 size-4" />
                      Redact & download
                    </>
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
        Pages containing redaction boxes are re-rendered as images with the
        boxes permanently burned in — the content underneath is destroyed, not
        just hidden. Those pages lose selectable text; untouched pages stay
        exactly as they were. Always double-check every page before sharing the
        result.
      </ToolNote>
    </div>
  );
}
