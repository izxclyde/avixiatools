"use client";

import { useRef, useState } from "react";
import { AlertCircle, Loader2, Scissors, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { baseName, chunkPages, parseRangeSegment } from "@/lib/logic/pdf";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { getPdfLib, loadPdfDoc, pdfBlob } from "@/lib/pdf";
import { ShareButton } from "@/components/tools/share-button";

export default function SplitPdf() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [mode, setMode] = useState<"ranges" | "every">("ranges");
  const [ranges, setRanges] = useState("");
  const [everyN, setEveryN] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; filename: string; label: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Drop stale output when a different document is opened (render-time reset).
  const [prevFile, setPrevFile] = useState<File | null>(null);
  const curFile = state?.file ?? null;
  if (curFile !== prevFile) {
    setPrevFile(curFile);
    setResult(null);
  }

  // Each comma segment becomes its own document, in the order typed.
  // Returns an error message instead of page groups when input is bad.
  const buildGroups = (): number[][] | string => {
    if (!state) return [];
    if (mode === "ranges") {
      const groups: number[][] = [];
      for (const segment of ranges.split(",")) {
        if (!segment.trim()) continue;
        const pages = parseRangeSegment(segment, state.pageCount);
        if (!pages) {
          return `Invalid range "${segment.trim()}". Use numbers like 3 or spans like 2-5.`;
        }
        groups.push(pages);
      }
      return groups.length > 0 ? groups : "Enter at least one page range.";
    }
    if (everyN < 1) return "Pages per file must be at least 1.";
    return chunkPages(
      Array.from({ length: state.pageCount }, (_, i) => i + 1),
      everyN
    );
  };

  const groups = state ? buildGroups() : null;
  const validGroups = typeof groups === "string" ? null : groups;
  const flatGroups = validGroups ? validGroups.flat() : [];
  const hasOverlap = flatGroups.length > new Set(flatGroups).size;
  const preview =
    typeof groups === "string"
      ? ""
      : groups && groups.length > 0
        ? `${groups.length} file${groups.length === 1 ? "" : "s"}`
        : "";

  const split = async () => {
    if (!state || !validGroups || busy) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const src = await loadPdfDoc(await state.file.arrayBuffer());
      const base = baseName(state.file.name);
      const files: File[] = [];

      for (let i = 0; i < validGroups.length; i++) {
        const out = await (await getPdfLib()).PDFDocument.create();
        const copied = await out.copyPages(
          src,
          validGroups[i].map((p) => p - 1)
        );
        copied.forEach((page) => out.addPage(page));
        const bytes = await out.save();
        files.push(new File([pdfBlob(bytes)], `${base}-part${i + 1}.pdf`));
      }

      if (files.length === 1) {
        downloadBlob(files[0], files[0].name);
        setResult({ blob: files[0], filename: files[0].name, label: files[0].name });
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.name, f));
        const blob = await zip.generateAsync({ type: "blob" });
        const zipName = `${base}-split.zip`;
        downloadBlob(blob, zipName);
        setResult({
          blob,
          filename: zipName,
          label: `${files.length} PDFs in ${zipName}`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Splitting failed.");
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
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            </div>

            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "ranges" | "every")}
              className="p-4"
            >
              <TabsList>
                <TabsTrigger value="ranges">Custom ranges</TabsTrigger>
                <TabsTrigger value="every">Every N pages</TabsTrigger>
              </TabsList>
              <TabsContent value="ranges" className="pt-4">
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="sp-ranges">
                    Ranges — each comma-separated part becomes its own file
                  </Label>
                  <Input
                    id="sp-ranges"
                    value={ranges}
                    onChange={(e) => setRanges(e.target.value)}
                    placeholder={`e.g. 1-${Math.max(1, state.pageCount - 1)},${state.pageCount}`}
                  />
                  {typeof groups === "string" && (
                    <p className="text-sm text-destructive">{groups}</p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="every" className="pt-4">
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="sp-every">Pages per file</Label>
                  <Input
                    id="sp-every"
                    type="number"
                    min={1}
                    max={state.pageCount}
                    value={everyN}
                    onChange={(e) =>
                      setEveryN(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </div>
              </TabsContent>
            </Tabs>

            {hasOverlap && (
              <p className="px-4 pb-2 text-xs text-amber-600">
                Some pages repeat across outputs.
              </p>
            )}
            <div className="flex border-t">
              <div className="flex flex-1 items-center px-4 text-sm text-muted-foreground">
                {preview}
              </div>
              <Button
                size="lg"
                onClick={split}
                disabled={busy || !validGroups}
                className="h-auto self-stretch rounded-none px-8 font-semibold"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Splitting…
                  </>
                ) : (
                  <>
                    <Scissors className="mr-2 size-4" />
                    Split & download
                  </>
                )}
              </Button>
            </div>

            {result && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  Downloaded:{" "}
                  <span className="font-medium text-foreground">{result.label}</span>
                </p>
                <ShareButton blob={result.blob} filename={result.filename} />
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
