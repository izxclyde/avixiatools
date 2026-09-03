"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { sanitizeWinAnsi, checkPdfFile, outputName } from "@/lib/logic/pdf";
import { getPdfLib, loadPdfDoc, pdfBlob } from "@/lib/pdf";
import { ShareButton } from "@/components/tools/share-button";
import { downloadBlob } from "@/lib/download";

type Position = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export default function WatermarkPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(60);
  const [opacity, setOpacity] = useState(20);
  const [rotation, setRotation] = useState(-30);
  const [color, setColor] = useState("#808080");
  const [position, setPosition] = useState<Position>("center");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((incoming: FileList | File[]) => {
    const pdf = [...incoming].find(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdf) {
      setError("Only PDF files are supported.");
      return;
    }
    const tooBig = checkPdfFile(pdf);
    if (tooBig) {
      setError(tooBig);
      return;
    }
    setError(null);
    setFile(pdf);
  }, []);

  const apply = async () => {
    if (!file || !text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setWarn(
      sanitizeWinAnsi(text) !== text
        ? 'Some characters are not supported and will render as "?".'
        : null
    );
    try {
      const doc = await loadPdfDoc(await file.arrayBuffer());
      const { StandardFonts, degrees, rgb } = await getPdfLib();
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const label = sanitizeWinAnsi(text);

      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const w = font.widthOfTextAtSize(label, fontSize);
        const h = font.heightAtSize(fontSize);
        // Bounding box of the rotated stamp
        const bw = Math.abs(w * cos) + Math.abs(h * sin);
        const bh = Math.abs(w * sin) + Math.abs(h * cos);
        const margin = 36;

        let bx: number, by: number;
        switch (position) {
          case "top-left":
            bx = margin;
            by = height - margin - bh;
            break;
          case "top-right":
            bx = width - margin - bw;
            by = height - margin - bh;
            break;
          case "bottom-left":
            bx = margin;
            by = margin;
            break;
          case "bottom-right":
            bx = width - margin - bw;
            by = margin;
            break;
          default:
            bx = (width - bw) / 2;
            by = (height - bh) / 2;
        }

        // Offset the drawText origin so the rotated stamp centers inside the box
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const x = cx - ((w / 2) * cos - (h / 2) * sin);
        const y = cy - ((w / 2) * sin + (h / 2) * cos);

        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(
            parseInt(color.slice(1, 3), 16) / 255,
            parseInt(color.slice(3, 5), 16) / 255,
            parseInt(color.slice(5, 7), 16) / 255
          ),
          opacity: opacity / 100,
          rotate: degrees(rotation),
        });
      }

      const bytes = await doc.save();
      const blob = pdfBlob(bytes);
      const name = outputName(file.name, "-watermarked");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Watermarking failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div
          onDrop={(e) => {
            e.preventDefault();
            acceptFile(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !file && inputRef.current?.click()}
          className={`m-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            file
              ? ""
              : "cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              if (e.target.files) acceptFile(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center justify-between gap-4">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Clear
              </Button>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-4 size-12 text-muted-foreground" />
              <p className="text-lg font-medium">Drop a PDF here</p>
              <p className="mt-1 text-sm text-muted-foreground">or click to select a file</p>
            </>
          )}
        </div>

        {file && (
          <div className="grid gap-x-6 gap-y-4 border-t p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="wm-text">Watermark text</Label>
              <Input
                id="wm-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="CONFIDENTIAL"
              />
              {warn && <p className="text-xs text-amber-600">{warn}</p>}
            </div>
            <div className="space-y-2">
              <Label>Size ({fontSize}pt)</Label>
              <Slider
                value={fontSize}
                min={20}
                max={160}
                step={2}
                onValueChange={(v) => setFontSize(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Opacity ({opacity}%)</Label>
              <Slider
                value={opacity}
                min={5}
                max={100}
                step={5}
                onValueChange={(v) => setOpacity(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rotation ({rotation}°)</Label>
              <Slider
                value={rotation}
                min={-90}
                max={90}
                step={15}
                onValueChange={(v) => setRotation(v)}
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label>Position</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="top-left">Top left</SelectItem>
                    <SelectItem value="top-right">Top right</SelectItem>
                    <SelectItem value="bottom-left">Bottom left</SelectItem>
                    <SelectItem value="bottom-right">Bottom right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wm-color">Colour</Label>
                <input
                  id="wm-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="block size-9 cursor-pointer rounded-md border bg-card p-1"
                />
              </div>
            </div>
          </div>
        )}

        {file && (
          <div className="border-t">
            <Button
              size="lg"
              onClick={apply}
              disabled={busy || !text.trim()}
              className="h-14 w-full rounded-none text-base font-semibold"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  Applying…
                </>
              ) : (
                "Apply watermark & download"
              )}
            </Button>
            {result && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  Downloaded:{" "}
                  <span className="font-medium text-foreground">{result.name}</span>
                </p>
                <ShareButton blob={result.blob} filename={result.name} />
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
