"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { downloadBlob } from "@/lib/download";
import { getPdfMake } from "@/lib/pdf";

type Source = { name: string; text: string };

export default function TxtToPdf() {
  const [source, setSource] = useState<Source | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((incoming: FileList | File[]) => {
    const file = [...incoming].find(
      (f) =>
        f.type === "text/plain" ||
        /\.(txt|md|log)$/i.test(f.name)
    );
    if (!file) {
      setError("Only plain-text files are supported.");
      return;
    }
    file.text().then((text) => {
      setError(null);
      setSource({ name: file.name, text });
    });
  }, []);

  const build = async () => {
    if (!source?.text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const pdfMake = await getPdfMake();
      // Blank lines split paragraphs; single newlines become line breaks
      const paragraphs = source.text
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/)
        .map((p) => ({ text: p.trim(), style: "body" }) as Record<string, unknown>);

      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          pdfMake.createPdf({ content: paragraphs, styles }).getBlob(resolve);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("PDF creation failed."));
        }
      });

      const name = source.name.replace(/\.[^.]+$/i, "") + ".pdf";
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Building the PDF failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-3 border-b p-4">
          <Textarea
            value={source?.text ?? ""}
            onChange={(e) => {
              setSource({
                name: source?.name ?? "document.txt",
                text: e.target.value,
              });
              setResult(null);
            }}
            placeholder="Paste text here…"
            aria-label="Text to convert"
            className="min-h-64 resize-y border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex items-center border-t">
          <div
            onDrop={(e) => {
              e.preventDefault();
              acceptFile(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="flex flex-1 cursor-pointer items-center gap-2 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,.log,text/plain"
              onChange={(e) => {
                if (e.target.files) acceptFile(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <Upload className="size-4" />
            …or drop a .txt / .md file here
          </div>
          {source && (
            <>
              <span className="flex min-w-0 items-center gap-1.5 px-2 text-xs text-muted-foreground sm:flex-1">
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{source.name}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSource(null)}
                className="mr-1"
              >
                <Trash2 className="mr-2 size-4" />
                Clear
              </Button>
            </>
          )}
          <div className="flex items-center gap-2 self-stretch border-l pl-2 pr-2">
            <ShareButton
              blob={result?.blob}
              filename={result?.name ?? ""}
              variant="ghost"
              className="font-semibold"
            />
            <Button
              onClick={build}
              disabled={!source?.text.trim() || busy}
              className="font-semibold"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Building…
                </>
              ) : (
                "Build PDF"
              )}
            </Button>
          </div>
        </div>

        {result && (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            Downloaded{" "}
            <span className="font-medium text-foreground">{result.name}</span>
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
        The PDF uses a standard embedded font and keeps real selectable text.
        Formatting beyond paragraphs and line breaks is not preserved.
      </ToolNote>
    </div>
  );
}

const styles: Record<string, Record<string, unknown>> = {
  body: { fontSize: 11, lineHeight: 1.5, marginBottom: 8 },
};
