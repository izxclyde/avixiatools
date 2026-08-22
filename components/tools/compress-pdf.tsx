"use client";

import { useRef, useState } from "react";
import { AlertCircle, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { shareOrDownload } from "@/lib/download";
import { canvasToBlob, createPdfDoc, pdfBlob, renderPageToCanvas } from "@/lib/pdf";
import { formatBytes } from "@/lib/logic/pdf";

// ponytail: whole-page JPEG re-encode — text becomes an image (same tradeoff
// as most in-browser compressors). Real content-stream optimisation would need
// a much heavier pipeline.
const PRESETS = {
  low: { scale: 1.0, quality: 0.45 },
  medium: { scale: 1.5, quality: 0.65 },
  high: { scale: 2.0, quality: 0.8 },
} as const;

type Quality = keyof typeof PRESETS;

export default function CompressPdf() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [quality, setQuality] = useState<Quality>("medium");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ before: number; after: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const compress = async () => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: state.pageCount });
    try {
      const preset = PRESETS[quality];
      const out = await createPdfDoc();

      for (let i = 1; i <= state.pageCount; i++) {
        const pageProxy = await state.pdf.getPage(i);
        const base = pageProxy.getViewport({ scale: 1 });
        // Cap render width so huge pages don't blow past canvas limits
        const targetWidth = Math.min(base.width * preset.scale, 3000);
        const canvas = await renderPageToCanvas(pageProxy, targetWidth);
        const blob = await canvasToBlob(canvas, "image/jpeg", preset.quality);
        const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const page = out.addPage([base.width, base.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: base.width,
          height: base.height,
        });
        setProgress({ done: i, total: state.pageCount });
      }

      const bytes = await out.save();
      setResult({ before: state.file.size, after: bytes.length });
      await shareOrDownload(
        pdfBlob(bytes),
        state.file.name.replace(/\.pdf$/i, "-compressed.pdf")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compression failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const saved =
    result && result.after < result.before
      ? Math.round((1 - result.after / result.before) * 100)
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        {state ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {state.file.name}
                <span className="text-muted-foreground">
                  {" "}
                  ({state.pageCount} pages, {formatBytes(state.file.size)})
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            </div>

            <div className="p-4">
              <div className="max-w-sm space-y-2">
                <Label>Quality</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — smallest file</SelectItem>
                    <SelectItem value="medium">Medium — balanced</SelectItem>
                    <SelectItem value="high">High — best look</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Pages are re-encoded as images, so scanned text stays readable but
                  is no longer selectable.
                </p>
              </div>
            </div>

            {progress && (
              <div className="border-t">
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Compressing page {progress.done} of {progress.total}…
                </div>
                <div className="h-2 w-full overflow-hidden bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 border-t p-4">
              <p className="text-sm text-muted-foreground">
                {result && (
                  <>
                    {formatBytes(result.before)} → {formatBytes(result.after)}
                    {saved !== null && saved > 0 && (
                      <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                        −{saved}%
                      </span>
                    )}
                    {saved === null && " — this file is already well compressed"}
                  </>
                )}
              </p>
              <Button onClick={compress} disabled={busy} className="font-semibold">
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  "Compress & download"
                )}
              </Button>
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
    </div>
  );
}
