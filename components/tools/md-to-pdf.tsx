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
import { contentToBlob, mdToContent } from "@/lib/pdfdoc";

export default function MdToPdf() {
  const [md, setMd] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((incoming: FileList | File[]) => {
    const file = [...incoming].find((f) =>
      /\.(md|markdown|txt)$/i.test(f.name)
    );
    if (!file) {
      setError("Only Markdown (.md/.markdown) or plain-text files are supported.");
      return;
    }
    file.text().then((text) => {
      setError(null);
      setMd(text);
      setResult(null);
    });
  }, []);

  const build = async () => {
    if (!md.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await contentToBlob(mdToContent(md), orientation);
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
            value={md}
            onChange={(e) => {
              setMd(e.target.value);
              setResult(null);
            }}
            placeholder={"# Heading\n\nParagraph with **bold**, *italics* and `code`.\n\n- list item\n- another"}
            aria-label="Markdown source"
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
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              onChange={(e) => {
                if (e.target.files) acceptFile(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
            <Upload className="size-4" />
            …or drop a .md / .markdown file here
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
          {md && (
            <Button variant="ghost" size="sm" onClick={() => setMd("")}>
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
            <Button onClick={build} disabled={!md.trim() || busy} className="font-semibold">
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
        Supports headings, paragraphs, bold/italic, lists, tables, quotes,
        horizontal rules and fenced code. Images, links and inline HTML are
        reduced to their text; code renders in italics rather than a monospace
        font.
      </ToolNote>
    </div>
  );
}
