"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  PenLine,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { loadPdfDoc, pdfBlob, renderPageToCanvas } from "@/lib/pdf";

// --- signature capture -------------------------------------------------------

const PAD_W = 600;
const PAD_H = 200;

type Signature = { url: string; aspect: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Crop fully-transparent margins so placement isn't offset by empty space. */
async function trimTransparent(dataUrl: string): Promise<Signature> {
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);

  let minX = c.width;
  let minY = c.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return { url: dataUrl, aspect: c.width / c.height };

  const pad = 6;
  const w = Math.min(maxX - minX + 1 + pad * 2, c.width);
  const h = Math.min(maxY - minY + 1 + pad * 2, c.height);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(img, minX - pad, minY - pad, w, h, 0, 0, w, h);
  return { url: out.toDataURL("image/png"), aspect: w / h };
}

/**
 * Knock out near-white, low-saturation pixels so signatures photographed on
 * white paper composite cleanly. Skipped when the image already has alpha.
 */
async function makeBackgroundTransparent(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, c.width, c.height);
  const d = imageData.data;

  let hasAlpha = false;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 250) {
      hasAlpha = true;
      break;
    }
  }
  if (!hasAlpha) {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      if (luminance > 232 && saturation < 24) d[i + 3] = 0;
    }
    ctx.putImageData(imageData, 0, 0);
  }
  return c.toDataURL("image/png");
}

function SignaturePad({
  value,
  onDone,
}: {
  value: string | null;
  onDone: (sig: Signature | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pointFromEvent(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk.current = true;
  };

  const end = async () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!hasInk.current) return;
    const url = canvasRef.current!.toDataURL("image/png");
    onDone(await trimTransparent(url));
  };

  const clearPad = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onDone(null);
  };

  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvasRef}
        width={PAD_W}
        height={PAD_H}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="h-32 w-full touch-none rounded-md border border-dashed bg-white"
        aria-label="Signature drawing area"
      />
      <Button variant="outline" size="sm" onClick={clearPad} disabled={!value}>
        <Trash2 className="mr-2 size-4" />
        Clear signature
      </Button>
    </div>
  );
}

function SignatureUpload({
  removeBackground,
  value,
  onError,
  onDone,
}: {
  removeBackground: boolean;
  value: string | null;
  onError: (message: string) => void;
  onDone: (sig: Signature | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(
    (incoming: FileList | File[]) => {
      const file = [...incoming].find((f) =>
        /^image\/(png|jpeg|webp)$/.test(f.type)
      );
      if (!file) {
        onError("Use a PNG, JPEG or WebP image.");
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          let url = reader.result as string;
          if (removeBackground) url = await makeBackgroundTransparent(url);
          onDone(await trimTransparent(url));
        } catch {
          onError("Couldn't process that image — try another one.");
        }
      };
      reader.readAsDataURL(file);
    },
    [removeBackground, onDone, onError]
  );

  return (
    <div className="space-y-2">
      <div
        onDrop={(e) => {
          e.preventDefault();
          acceptFile(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/50 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          onChange={(e) => {
            if (e.target.files) acceptFile(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
        <ImagePlus className="size-6" />
        Drop a photo of your signature…
      </div>
      {value && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-provided data URL preview */}
          <img
            src={value}
            alt="Uploaded signature"
            className="h-10 max-w-40 bg-white object-contain"
          />
          <Button variant="ghost" size="sm" onClick={() => onDone(null)}>
            <Trash2 className="mr-2 size-4" />
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

// --- tool --------------------------------------------------------------------

export default function SignPdf() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [signature, setSignature] = useState<Signature | null>(null);
  const [sigMode, setSigMode] = useState<"draw" | "upload">("draw");
  const [removeBackground, setRemoveBackground] = useState(true);
  const [pageNum, setPageNum] = useState(1);
  const [placement, setPlacement] = useState<{ cx: number; cy: number } | null>(null);
  const [widthPt, setWidthPt] = useState(140);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const previewRef = useRef<HTMLDivElement>(null); // canvas host — React never touches its children
  const inputRef = useRef<HTMLInputElement>(null);

  // Render the current page preview into the dedicated host node
  useEffect(() => {
    const host = previewRef.current;
    if (!state || !host) return;
    let cancelled = false;
    host.innerHTML = "";
    (async () => {
      try {
        const page = await state.pdf.getPage(pageNum);
        const canvas = await renderPageToCanvas(page, 560);
        if (cancelled) return;
        canvas.className = "block h-auto w-full cursor-crosshair";
        canvas.dataset.preview = "true";
        host.appendChild(canvas);
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, pageNum]);

  const goToPage = (delta: 1 | -1) => {
    setPageNum((prev) => Math.min(state?.pageCount ?? 1, Math.max(1, prev + delta)));
  };

  /** Translate a click on the preview canvas into page-fraction coordinates. */
  const place = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = previewRef.current?.querySelector<HTMLCanvasElement>("canvas[data-preview]");
      if (!canvas || !signature) return;
      const rect = canvas.getBoundingClientRect();
      setPlacement({
        cx: (e.clientX - rect.left) / rect.width,
        cy: (e.clientY - rect.top) / rect.height,
      });
      setResult(null);
    },
    [signature]
  );

  const apply = async () => {
    if (!state || !signature || !placement || busy) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await loadPdfDoc(await state.file.arrayBuffer());
      const pngBytes = new Uint8Array(
        await (await fetch(signature.url)).arrayBuffer()
      );
      const image = await doc.embedPng(pngBytes);
      const page = doc.getPage(pageNum - 1);
      const { width, height } = page.getSize();

      const w = widthPt;
      const h = w / signature.aspect;
      const x = placement.cx * width - w / 2;
      const y = height - placement.cy * height - h / 2;
      page.drawImage(image, { x, y, width: w, height: h });

      const bytes = await doc.save();
      const blob = pdfBlob(bytes);
      const name = state.file.name.replace(/\.pdf$/i, "-signed.pdf");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signing failed.");
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
                {state.file.name}
                <span className="text-muted-foreground"> ({state.pageCount} pages)</span>
              </span>
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            </div>

            <div className="grid gap-6 p-4 sm:grid-cols-[280px_1fr]">
              {/* Step 1 — signature */}
              <div className="space-y-2">
                <Label>1. Your signature</Label>
                <Tabs
                  value={sigMode}
                  onValueChange={(v) => setSigMode(v as "draw" | "upload")}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="draw" className="flex-1">
                      Draw
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex-1">
                      Upload
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="draw" className="pt-2 outline-none">
                    <SignaturePad
                      value={signature?.url ?? null}
                      onDone={(s) => {
                        setSignature(s);
                        setResult(null);
                      }}
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="space-y-2 pt-2 outline-none">
                    <SignatureUpload
                      removeBackground={removeBackground}
                      value={signature?.url ?? null}
                      onError={setError}
                      onDone={(s) => {
                        setSignature(s);
                        setResult(null);
                      }}
                    />
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={removeBackground}
                        onCheckedChange={(v) => setRemoveBackground(!!v)}
                      />
                      Make background transparent
                    </label>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Step 2 — placement */}
              <div className="space-y-2">
                <Label>
                  2. Pick a page, then click where the signature should go{" "}
                  <span className="text-muted-foreground">(page {pageNum})</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => goToPage(-1)} disabled={pageNum === 1}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="min-w-16 text-center text-sm text-muted-foreground">
                    {pageNum} / {state.pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(1)}
                    disabled={pageNum === state.pageCount}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  {signature && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {placement ? "Placed ✓" : "Click the page…"}
                    </span>
                  )}
                </div>
                {/* Outer frame is React-managed; the canvas lives in an
                    untouched host node below so imperative rendering and React
                    reconciliation never fight over the same children. */}
                <div className="relative mx-auto max-w-md overflow-hidden rounded-md border bg-muted p-2">
                  <div ref={previewRef} onClick={place} />
                  {!signature && (
                    <div className="absolute inset-0 z-10 bg-background/60" />
                  )}
                  {placement && (
                    <span
                      className="pointer-events-none absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/30"
                      style={{
                        left: `calc(${(placement.cx * 100).toFixed(2)}% + 0.5rem)`,
                        top: `calc(${(placement.cy * 100).toFixed(2)}% + 0.5rem)`,
                      }}
                    />
                  )}
                </div>
                {signature && (
                  <div className="max-w-md space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sign-width">Signature width ({widthPt}pt)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPlacement(null)}
                        disabled={!placement}
                      >
                        Reset spot
                      </Button>
                    </div>
                    <Slider
                      id="sign-width"
                      value={widthPt}
                      min={60}
                      max={320}
                      step={10}
                      onValueChange={(v) => setWidthPt(v)}
                    />
                  </div>
                )}
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
                <Button
                  size="lg"
                  onClick={apply}
                  disabled={!signature || !placement || busy}
                  className="font-semibold"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Signing…
                    </>
                  ) : (
                    <>
                      <PenLine className="mr-2 size-4" />
                      Sign & download
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
        This adds a visible image of your signature — it is not a cryptographic
        digital signature. One placement per pass; run it again to add more.
        Your drawing or photo never leaves your device.
      </ToolNote>
    </div>
  );
}
