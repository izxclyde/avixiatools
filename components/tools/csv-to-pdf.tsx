"use client";

import { useCallback, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { downloadBlob } from "@/lib/download";
import { parseCsv } from "@/lib/logic/csv";
import { getPdfMake } from "@/lib/pdfdoc";

export default function CsvToPdf() {
  const [csv, setCsv] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((incoming: FileList | File[]) => {
    const file = [...incoming].find(
      (f) => f.type === "text/csv" || /\.csv$/i.test(f.name)
    );
    if (!file) {
      setError("Only .csv files are supported.");
      return;
    }
    file.text().then((text) => {
      setError(null);
      setCsv(text);
      setResult(null);
    });
  }, []);

  const build = async () => {
    if (!csv.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const rows = parseCsv(csv);
      if (rows.length === 0) throw new Error("The CSV appears to be empty.");
      const width = Math.max(...rows.map((r) => r.length));
      const pad = (r: string[], style: "header" | "cell") =>
        r
          .map((cell) => ({ text: cell, style }))
          .concat(Array.from({ length: width - r.length }, () => ({ text: "", style })));
      // First CSV row becomes the table header
      const [first, ...rest] = rows;
      const body = [pad(first, "header"), ...rest.map((r) => pad(r, "cell"))];

      const doc = {
        content: [
          {
            table: { body },
            layout: "lightHorizontalLines",
          },
        ],
        styles: {
          header: { bold: true, fillColor: "#f1f0f4", fontSize: 10 },
          cell: { fontSize: 9.5 },
        },
        defaultStyle: { fontSize: 10 },
        pageMargins: [36, 36, 36, 36],
        pageSize: "A4",
        pageOrientation: orientation,
      };

      const pdfMake = await getPdfMake();
      // pdfmake 0.3's getBlob() returns a Promise; callback style never fires
      const blob = await pdfMake
        .createPdf(doc as unknown as Record<string, unknown>)
        .getBlob();

      downloadBlob(blob, "table.pdf");
      setResult({ blob, name: "table.pdf" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Building the PDF failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <Textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setResult(null);
            }}
            placeholder={"Name,Quantity,Price\nWidget,2,9.99"}
            aria-label="CSV data"
            className="min-h-48 resize-y font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t p-4">
          <div
            onDrop={(e) => {
              e.preventDefault();
              acceptFile(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                if (e.target.files) acceptFile(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <Upload className="size-4" />
            …or drop a .csv file here
          </div>
          <div className="w-40 space-y-1">
            <Label className="sr-only">Orientation</Label>
            <Select
              value={orientation}
              onValueChange={(v) => setOrientation(v as "portrait" | "landscape")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait A4</SelectItem>
                <SelectItem value="landscape">Landscape A4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {csv && (
            <Button variant="ghost" size="sm" onClick={() => setCsv("")}>
              <Trash2 className="mr-2 size-4" />
              Clear
            </Button>
          )}
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
            <Button onClick={build} disabled={!csv.trim() || busy} className="font-semibold">
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Building…
                </>
              ) : (
                "Build PDF table"
              )}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <ToolNote>
        The first CSV row becomes the table header. Very wide tables fit better
        in landscape; columns are sized automatically and long cells wrap.
      </ToolNote>
    </div>
  );
}
