"use client";

import { useRef, useState } from "react";
import { AlertCircle, Loader2, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dropzone } from "@/components/tools/dropzone";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { getPdfLib, pdfBlob, renderPageToCanvas } from "@/lib/pdf";
import { baseName, outputName, sanitizeWinAnsi } from "@/lib/logic/pdf";
import {
  bboxToTextPlacement,
  collectWords,
  hasTextLayer,
  unrotateBbox,
  type OcrWord,
  type PageGeometry,
} from "@/lib/logic/ocr";

const LANGUAGES = [
  { value: "eng", label: "English" },
  { value: "deu", label: "German" },
  { value: "fra", label: "French" },
  { value: "spa", label: "Spanish" },
  { value: "ita", label: "Italian" },
  { value: "por", label: "Portuguese" },
  { value: "nld", label: "Dutch" },
] as const;

type Lang = (typeof LANGUAGES)[number]["value"];
type Mode = "pdf" | "text";

type OcrPage = { page: number; words: OcrWord[]; geometry: PageGeometry };

export default function OcrPdf() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [lang, setLang] = useState<Lang>("eng");
  const [mode, setMode] = useState<Mode>("pdf");
  const [autoStraighten, setAutoStraighten] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const cancelRef = useRef(false);

  const run = async () => {
    if (!state || busy) return;
    cancelRef.current = false;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { createWorker } = await import("tesseract.js");
      setProgress("Loading OCR engine…");
      // ponytail: single language per run — multi-language docs need re-running per lang
      const worker = await createWorker(lang);
      try {
        const texts: string[] = [];
        const ocrPages: OcrPage[] = [];

        for (let i = 1; i <= state.pageCount; i++) {
          if (cancelRef.current) {
            setError("Cancelled — no file was downloaded.");
            return;
          }
          setProgress(`Reading page ${i} of ${state.pageCount}…`);
          const pageProxy = await state.pdf.getPage(i);

          // Born-digital pages already carry a text layer; OCRing them again
          // would stack a second, invisible copy of the same words.
          const existing = await pageProxy.getTextContent();
          const existingText = existing.items
            .map((item) => ("str" in item ? item.str : ""))
            .join("");
          if (hasTextLayer(existingText)) {
            texts.push(existingText.trim());
            continue;
          }

          const base = pageProxy.getViewport({ scale: 1 });
          // 2x keeps small print legible; the cap stops runaway canvases.
          const canvas = await renderPageToCanvas(
            pageProxy,
            Math.min(base.width * 2, 3000)
          );
          const { data } = await worker.recognize(
            canvas,
            autoStraighten ? { rotateAuto: true } : {},
            mode === "pdf" ? { text: true, blocks: true } : { text: true }
          );
          texts.push(data.text.trim());
          if (mode !== "pdf") continue;

          const theta = autoStraighten ? data.rotateRadians ?? 0 : 0;
          const words = collectWords(data.blocks).map((word) =>
            theta
              ? {
                  ...word,
                  bbox: unrotateBbox(word.bbox, theta, canvas.width, canvas.height),
                }
              : word
          );
          const view = pageProxy.view;
          ocrPages.push({
            page: i,
            words,
            geometry: {
              scale: canvas.width / base.width,
              originX: view[0],
              originY: view[1],
              width: view[2] - view[0],
              height: view[3] - view[1],
              rotation: pageProxy.rotate,
            },
          });
        }

        if (mode === "text") {
          const joined = texts.filter(Boolean).join("\n\n");
          if (!joined.trim()) throw new Error("No readable text was found on any page.");
          const blob = new Blob([joined], { type: "text/plain" });
          const name = `${baseName(state.file.name)}.txt`;
          downloadBlob(blob, name);
          setResult({ blob, name });
          return;
        }

        setProgress("Adding the text layer…");
        const { PDFDocument, StandardFonts, degrees } = await getPdfLib();
        // Loading the original keeps every page's existing content and
        // resolution — only an invisible layer of words is added on top.
        const doc = await PDFDocument.load(
          new Uint8Array(await state.file.arrayBuffer())
        );
        const font = await doc.embedFont(StandardFonts.Helvetica);
        for (const { page, words, geometry } of ocrPages) {
          const target = doc.getPage(page - 1);
          for (const word of words) {
            const place = bboxToTextPlacement(word.bbox, geometry);
            target.drawText(sanitizeWinAnsi(word.text), {
              x: place.x,
              y: place.y,
              size: place.size,
              font,
              opacity: 0,
              rotate: degrees(place.rotate),
            });
          }
        }
        const blob = pdfBlob(await doc.save());
        const name = outputName(state.file.name, "-searchable");
        downloadBlob(blob, name);
        setResult({ blob, name });
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed.");
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

            <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Output</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">Searchable PDF</SelectItem>
                    <SelectItem value="text">Plain text (.txt)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-full flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-straighten">Auto-straighten skewed scans</Label>
                  <p className="text-xs text-muted-foreground">
                    Detects and corrects page skew before recognising. Leave off
                    if the text layer looks misplaced.
                  </p>
                </div>
                <Switch
                  id="auto-straighten"
                  checked={autoStraighten}
                  onCheckedChange={setAutoStraighten}
                />
              </div>
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
                <ShareButton
                  blob={result?.blob}
                  filename={result?.name ?? ""}
                  variant="outline"
                  className="font-semibold"
                />
                {busy && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                    className="font-semibold"
                  >
                    Cancel
                  </Button>
                )}
                <Button size="lg" onClick={run} disabled={busy} className="font-semibold">
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Working…
                    </>
                  ) : (
                    <>
                      <ScanText className="mr-2 size-4" />
                      Run OCR
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Dropzone
            accept="application/pdf,.pdf"
            onFiles={open}
            title={opening ? "Opening…" : "Drop a scanned PDF here"}
            subtitle={opening ? undefined : "or click to select a file"}
            disabled={opening}
          />
        )}
      </div>

      {(openError ?? error) && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{openError ?? error}</p>
        </div>
      )}

      <ToolNote>
        Runs Tesseract OCR entirely in your browser. Your original pages keep
        their existing content and resolution — only an invisible layer of
        recognised words is added, so the file stays close to its original size.
        Pages that already contain text are left untouched. The first run
        downloads the language model (10–25MB) which is cached afterwards.
        Recognition quality depends on scan quality, and the text layer is
        machine-read, so expect occasional misreads. Only Latin-script
        languages can be written into the text layer.
      </ToolNote>
    </div>
  );
}
