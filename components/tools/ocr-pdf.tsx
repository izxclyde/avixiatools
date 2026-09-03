"use client";

import { useRef, useState } from "react";
import { AlertCircle, Loader2, ScanText, Upload } from "lucide-react";
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
import { ToolNote } from "@/components/tools/tool-note";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { canvasToBlob, getPdfLib, pdfBlob, renderPageToCanvas } from "@/lib/pdf";
import { baseName, outputName } from "@/lib/logic/pdf";

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

export default function OcrPdf() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [lang, setLang] = useState<Lang>("eng");
  const [mode, setMode] = useState<Mode>("pdf");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
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
        const pages: Blob[] = [];
        const texts: string[] = [];

        for (let i = 1; i <= state.pageCount; i++) {
          if (cancelRef.current) {
            setError("Cancelled — no file was downloaded.");
            return;
          }
          setProgress(`Reading page ${i} of ${state.pageCount}…`);
          const pageProxy = await state.pdf.getPage(i);
          const base = pageProxy.getViewport({ scale: 1 });
          // 72dpi baseline keeps tesseract's PDF pages the same size as the original
          const canvas = await renderPageToCanvas(pageProxy, Math.min(base.width * 2, 3000));
          const image = await canvasToBlob(canvas, "image/png");

          if (mode === "text") {
            const { data } = await worker.recognize(image);
            texts.push(data.text.trim());
          } else {
            // Searchable-PDF output: page image + invisible machine-read text layer
            const { data } = await worker.recognize(image, {}, { pdf: true });
            if (!data.pdf) throw new Error("The OCR engine returned no PDF data.");
            pages.push(pdfBlob(new Uint8Array(data.pdf as unknown as Uint8Array)));
          }
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

        setProgress("Assembling searchable PDF…");
        const out = await (await getPdfLib()).PDFDocument.create();
        for (const page of pages) {
          const doc = await (
            await getPdfLib()
          ).PDFDocument.load(new Uint8Array(await page.arrayBuffer()));
          const [copied] = await out.copyPages(doc, [0]);
          out.addPage(copied);
        }
        const bytes = await out.save();
        const blob = pdfBlob(bytes);
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
              {opening ? "Opening…" : "Drop a scanned PDF here"}
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
        Runs Tesseract OCR entirely in your browser. The first run downloads the
        language model (10–25MB) which is cached afterwards. Recognition quality
        depends on scan quality — clean, straight scans work best. The
        searchable-PDF text layer is machine-read, so expect occasional
        misreads.
      </ToolNote>
    </div>
  );
}
