"use client";

import { useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { usePdfFile } from "@/hooks/use-pdf-file";
import { downloadBlob } from "@/lib/download";
import { extractPageLines } from "@/lib/pdf";
import { splitColumns } from "@/lib/logic/csv";

export default function PdfToExcel() {
  const { state, error: openError, opening, open, clear } = usePdfFile();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const convert = async () => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      let totalRows = 0;

      for (let i = 1; i <= state.pageCount; i++) {
        setProgress(`Extracting page ${i} of ${state.pageCount}…`);
        const lines = await extractPageLines(state.pdf, i);
        const rows = lines.map((line) => splitColumns(line));
        if (rows.length === 0) continue;
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        // Excel sheet names max 31 chars
        const name = `Page ${i}`.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, sheet, name);
        totalRows += rows.length;
      }

      if (totalRows === 0) {
        throw new Error(
          "No embedded text found — this looks like a scan. Use the OCR tool instead."
        );
      }

      setProgress("Building workbook…");
      const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const name = state.file.name.replace(/\.pdf$/i, ".xlsx");
      downloadBlob(blob, name);
      setResult({ blob, name });
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

      <ToolNote>
        Each page becomes a worksheet; rows are the extracted text lines and
        columns are split where wide gaps appear in the layout — real table
        structures aren&apos;t detected, so complex tables may need cleanup.
        Scanned PDFs without embedded text produce nothing — use the OCR tool.
      </ToolNote>
    </div>
  );
}
