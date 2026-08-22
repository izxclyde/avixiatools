"use client";

import { useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ShareButton } from "@/components/tools/share-button";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { canvasToBlob, renderPageToCanvas } from "@/lib/pdf";

type Format = "jpeg" | "png";

export default function PdfToJpg() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [format, setFormat] = useState<Format>("jpeg");
  const [scalePct, setScalePct] = useState(150);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const convert = async () => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: state.pageCount });
    try {
      const mime = format === "jpeg" ? "image/jpeg" : "image/png";
      const base = state.file.name.replace(/\.pdf$/i, "");
      const files: File[] = [];

      for (let i = 1; i <= state.pageCount; i++) {
        const page = await state.pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = await renderPageToCanvas(
          page,
          Math.min(viewport.width * (scalePct / 100), 4000)
        );
        const blob = await canvasToBlob(canvas, mime, 0.9);
        files.push(new File([blob], `${base}-p${i}.${format}`, { type: mime }));
        setProgress({ done: i, total: state.pageCount });
      }

      let out: { blob: Blob; name: string };
      if (files.length === 1) {
        out = { blob: files[0], name: files[0].name };
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.name, f));
        const zipName = `${base}-images.zip`;
        out = { blob: await zip.generateAsync({ type: "blob" }), name: zipName };
      }
      downloadBlob(out.blob, out.name);
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
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
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            </div>

            <div className="p-4">
              <div className="flex max-w-sm gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jpeg">JPG</SelectItem>
                      <SelectItem value="png">PNG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Quality</Label>
                  <Select
                    value={String(scalePct)}
                    onValueChange={(v) => setScalePct(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">Standard</SelectItem>
                      <SelectItem value="150">High</SelectItem>
                      <SelectItem value="200">Very high</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {progress && (
              <div className="border-t">
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Converting page {progress.done} of {progress.total}…
                </div>
                <div className="h-2 w-full overflow-hidden bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="border-t p-4 text-sm text-muted-foreground">
              Multi-page PDFs are downloaded as a ZIP archive of images.
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
                <Button onClick={convert} disabled={busy} className="font-semibold">
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Working…
                    </>
                  ) : (
                    "Convert & download"
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
    </div>
  );
}
