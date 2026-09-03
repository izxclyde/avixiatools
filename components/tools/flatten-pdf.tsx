"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { downloadBlob } from "@/lib/download";
import { checkPdfFile, outputName } from "@/lib/logic/pdf";
import { canvasToBlob, loadPdfDoc, openPdfFile, pdfBlob, renderPageToCanvas } from "@/lib/pdf";

type Mode = "forms" | "full";

export default function FlattenPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("forms");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const acceptFile = useCallback((incoming: FileList | File[]) => {
    const list = [...incoming];
    const pdf = list.find(
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
    setResult(null);
    setFile(pdf);
    if (list.length > 1) {
      setError("Multiple files dropped — only the first is used.");
    }
  }, []);

  const flattenForms = async () => {
    if (!file) return;
    const doc = await loadPdfDoc(await file.arrayBuffer());
    const form = doc.getForm();
    const fields = form.getFields();
    if (fields.length === 0) {
      throw new Error(
        "This PDF has no fillable form fields. Use “Full rasterise” to lock in annotations instead."
      );
    }
    form.flatten();
    return doc.save();
  };

  // Rasterise every page so all markup, forms and annotations become flat pixels
  const flattenFull = async () => {
    if (!file) return;
    const src = await openPdfFile(file);
    const out = await (await import("@cantoo/pdf-lib")).PDFDocument.create();
    for (let i = 1; i <= src.numPages; i++) {
      if (cancelRef.current) {
        throw new Error("Cancelled — no file was downloaded.");
      }
      const page = await src.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const canvas = await renderPageToCanvas(page, Math.min(base.width * 1.5, 3000));
      const image = await out.embedJpg(
        new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", 0.85)).arrayBuffer())
      );
      const newPage = out.addPage([base.width, base.height]);
      newPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
    }
    return out.save();
  };

  const flatten = async () => {
    if (!file || busy) return;
    setBusy(true);
    cancelRef.current = false;
    setError(null);
    try {
      const bytes = mode === "forms" ? await flattenForms() : await flattenFull();
      if (!bytes) throw new Error("Flattening failed.");
      const blob = pdfBlob(bytes);
      const name = outputName(file.name, "-flat");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flattening failed.");
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
                  setResult(null);
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
              <p className="mt-1 text-sm text-muted-foreground">
                or click to select a file
              </p>
            </>
          )}
        </div>

        {file && (
          <div className="max-w-sm space-y-2 border-t p-4">
            <Label>Flatten mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="forms">Form fields only</SelectItem>
                <SelectItem value="full">Full rasterise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {file && (
          <div className="border-t p-4">
            <div className="flex items-center justify-between gap-4">
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
                <Button size="lg" onClick={flatten} disabled={busy} className="font-semibold">
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Flattening…
                    </>
                  ) : (
                    "Flatten & download"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <ToolNote>
        <strong className="font-medium text-foreground">Form fields only</strong>{" "}
        bakes filled-in form values into the page and keeps text selectable.{" "}
        <strong className="font-medium text-foreground">Full rasterise</strong>{" "}
        converts every page to an image — nothing stays editable or selectable,
        but all markup, forms and annotations are locked in.
      </ToolNote>
    </div>
  );
}
