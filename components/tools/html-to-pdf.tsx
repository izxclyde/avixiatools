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
import { contentToBlob, htmlToContent } from "@/lib/pdfdoc";
import { MAX_TEXT_CHARS } from "@/lib/logic/pdf";

export default function HtmlToPdf() {
  const [html, setHtml] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((incoming: FileList | File[]) => {
    const file = [...incoming].find(
      (f) => f.type === "text/html" || /\.html?$/i.test(f.name)
    );
    if (!file) {
      setError("Only .html / .htm files are supported.");
      return;
    }
    file.text().then((text) => {
      setError(null);
      setHtml(text);
      setResult(null);
    });
  }, []);

  const build = async () => {
    if (!html.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (html.length > MAX_TEXT_CHARS) {
        throw new Error(
          `Text is over the ${MAX_TEXT_CHARS.toLocaleString()} character limit — split it into smaller files first.`
        );
      }
      const content = htmlToContent(html);
      if (content.length === 0) throw new Error("No convertible content found in this HTML.");
      const blob = await contentToBlob(content, orientation);
      downloadBlob(blob, "document.pdf");
      setResult({ blob, name: "document.pdf" });
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
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              setResult(null);
            }}
            placeholder={"<h1>Heading</h1>\n<p>A paragraph.</p>\n<ul><li>List item</li></ul>"}
            aria-label="HTML source"
            className="min-h-64 resize-y font-mono text-xs"
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
              accept=".html,.htm,text/html"
              onChange={(e) => {
                if (e.target.files) acceptFile(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <Upload className="size-4" />
            …or drop an .html file here
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
          {html && (
            <Button variant="ghost" size="sm" onClick={() => setHtml("")}>
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
            <Button onClick={build} disabled={!html.trim() || busy} className="font-semibold">
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
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <ToolNote>
        Converts a block-level subset of HTML: headings, paragraphs, lists,
        tables, preformatted blocks and quotes. CSS styling, images, scripts
        and inline layout are intentionally ignored — the output is a clean,
        text-first document.
      </ToolNote>
    </div>
  );
}
