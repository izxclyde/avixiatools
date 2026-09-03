"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { checkPdfFile, formatPageLabel, outputName, sanitizeWinAnsi } from "@/lib/logic/pdf";
import { getPdfLib, loadPdfDoc, pdfBlob } from "@/lib/pdf";
import { ShareButton } from "@/components/tools/share-button";
import { downloadBlob } from "@/lib/download";

type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export default function PageNumbers() {
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState("{n} / {total}");
  const [startAt, setStartAt] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [position, setPosition] = useState<Position>("bottom-center");
  const [skipFirst, setSkipFirst] = useState(false);
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
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setWarn(
      sanitizeWinAnsi(template) !== template
        ? 'Some characters are not supported and will render as "?".'
        : null
    );
    try {
      const doc = await loadPdfDoc(await file.arrayBuffer());
      const { StandardFonts } = await getPdfLib();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;
      const margin = 32;

      pages.forEach((page, index) => {
        if (skipFirst && index === 0) return;
        const label = sanitizeWinAnsi(formatPageLabel(template, startAt + index, total));
        const { width, height } = page.getSize();
        const w = font.widthOfTextAtSize(label, fontSize);

        const x =
          position.endsWith("left")
            ? margin
            : position.endsWith("right")
              ? width - margin - w
              : (width - w) / 2;
        // Baseline sits one text-height below the top margin line
        const y = position.startsWith("top") ? height - margin - fontSize : margin;

        page.drawText(label, { x, y, size: fontSize, font });
      });

      const bytes = await doc.save();
      const blob = pdfBlob(bytes);
      const name = outputName(file.name, "-numbered");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adding page numbers failed.");
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
            file ? "" : "cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/50"
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
              <Label htmlFor="pn-template">
                Format — use <code className="text-xs">{"{n}"}</code> and{" "}
                <code className="text-xs">{"{total}"}</code>
              </Label>
              <Input
                id="pn-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
              {warn && <p className="text-xs text-amber-600">{warn}</p>}
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top-left">Top left</SelectItem>
                  <SelectItem value="top-center">Top centre</SelectItem>
                  <SelectItem value="top-right">Top right</SelectItem>
                  <SelectItem value="bottom-left">Bottom left</SelectItem>
                  <SelectItem value="bottom-center">Bottom centre</SelectItem>
                  <SelectItem value="bottom-right">Bottom right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pn-start">Start at</Label>
              <Input
                id="pn-start"
                type="number"
                min={0}
                value={startAt}
                onChange={(e) =>
                  setStartAt(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Font size ({fontSize}pt)</Label>
              <Slider
                value={fontSize}
                min={7}
                max={24}
                step={1}
                onValueChange={(v) => setFontSize(v)}
              />
            </div>
            <label className="flex items-center gap-2 pt-2 text-sm font-medium">
              <Checkbox checked={skipFirst} onCheckedChange={(v) => setSkipFirst(!!v)} />
              Skip first page (cover)
            </label>
          </div>
        )}

        {file && (
          <div className="border-t">
            <Button
              size="lg"
              onClick={apply}
              disabled={busy || !template.trim()}
              className="h-14 w-full rounded-none text-base font-semibold"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  Adding numbers…
                </>
              ) : (
                "Add page numbers & download"
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
