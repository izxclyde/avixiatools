"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download";
import { createPdfDoc, loadPdfDoc, pdfBlob } from "@/lib/pdf";
import { ShareButton } from "@/components/tools/share-button";

export default function MergePdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs = [...incoming].filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length === 0) {
      setError("Only PDF files can be merged.");
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...pdfs]);
  }, []);

  const move = (index: number, delta: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const merge = async () => {
    if (files.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const out = await createPdfDoc();
      for (const file of files) {
        const doc = await loadPdfDoc(await file.arrayBuffer());
        const pages = await out.copyPages(doc, doc.getPageIndices());
        pages.forEach((page) => out.addPage(page));
      }
      const bytes = await out.save();
      const blob = pdfBlob(bytes);
      const name = "merged.pdf";
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merging failed.");
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
            addFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="m-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
          <Upload className="mx-auto mb-4 size-12 text-muted-foreground" />
          <p className="text-lg font-medium">Drop PDFs here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to select two or more files
          </p>
        </div>

        {files.length > 0 && (
          <ul className="border-t">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 border-b px-4 py-2 last:border-b-0"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${file.name} up`}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => move(index, 1)}
                  disabled={index === files.length - 1}
                  aria-label={`Move ${file.name} down`}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex border-t">
          {files.length > 0 && (
            <>
              <input
                ref={listInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <Button
                variant="ghost"
                onClick={() => listInputRef.current?.click()}
                className="h-auto gap-2 self-stretch rounded-none px-5"
              >
                <Plus className="size-4" />
                Add more
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFiles([])}
                className="h-auto gap-2 self-stretch rounded-none px-5"
              >
                <Trash2 className="size-4" />
                Clear all
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button
            size="lg"
            onClick={merge}
            disabled={files.length < 2 || busy}
            className="h-auto self-stretch rounded-none px-8 font-semibold"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Merging…
              </>
            ) : (
              `Merge ${files.length > 1 ? `${files.length} files` : ""}`
            )}
          </Button>
        </div>

        {result && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              Downloaded:{" "}
              <span className="font-medium text-foreground">{result.name}</span>
            </p>
            <ShareButton blob={result.blob} filename={result.name} />
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
