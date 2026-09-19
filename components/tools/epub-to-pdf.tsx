"use client";

import { useCallback, useState } from "react";
import { AlertCircle, BookOpen, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { downloadBlob } from "@/lib/download";
import { contentToBlob, htmlToContent, type Content } from "@/lib/pdfdoc";
import { MAX_TEXT_CHARS } from "@/lib/logic/pdf";

type SpineDoc = { href: string };

export default function EpubToPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const acceptFile = useCallback((incoming: FileList | File[]) => {
    const epub = [...incoming].find(
      (f) => f.type === "application/epub+zip" || /\.epub$/i.test(f.name)
    );
    if (!epub) {
      setError("Only .epub files are supported.");
      return;
    }
    setError(null);
    setResult(null);
    setFile(epub);
  }, []);

  const build = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(file);

      // container.xml → OPF package location
      const containerXml = await zip.file("META-INF/container.xml")?.async("string");
      if (!containerXml) throw new Error("Not a valid EPUB (missing container.xml).");
      const container = new DOMParser().parseFromString(containerXml, "application/xml");
      const opfPath = container
        .getElementsByTagName("rootfile")[0]
        ?.getAttribute("full-path");
      if (!opfPath) throw new Error("Not a valid EPUB (missing package definition).");

      // OPF → spine order + manifest hrefs
      const opfText = await zip.file(opfPath)?.async("string");
      if (!opfText) throw new Error("Not a valid EPUB (package file unreadable).");
      const opfDir = opfPath.includes("/")
        ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
        : "";
      const opf = new DOMParser().parseFromString(opfText, "application/xml");

      const manifest = new Map<string, string>();
      for (const item of opf.getElementsByTagName("item")) {
        const id = item.getAttribute("id");
        const href = item.getAttribute("href");
        const type = item.getAttribute("media-type") ?? "";
        if (id && href && /xhtml|html/.test(type)) manifest.set(id, href);
      }
      const docs: SpineDoc[] = [];
      for (const ref of opf.getElementsByTagName("itemref")) {
        const idref = ref.getAttribute("idref");
        const href = idref ? manifest.get(idref) : undefined;
        if (href) docs.push({ href });
      }
      if (docs.length === 0) {
        throw new Error("No readable chapters found — DRM-protected books can't be converted.");
      }

      const parser = new DOMParser();
      const content: Content[] = [];
      let chapterIndex = 0;
      let skipped = 0;
      let totalChars = 0;
      for (const doc of docs) {
        chapterIndex++;
        setProgress(`Chapter ${chapterIndex} of ${docs.length}…`);
        const raw = doc.href.replace(/#.*$/, "");
        let decoded: string;
        try {
          decoded = decodeURIComponent(raw);
        } catch {
          decoded = raw;
        }
        const combined = decoded.startsWith("/") ? decoded.slice(1) : opfDir + decoded;
        const parts: string[] = [];
        for (const seg of combined.split("/")) {
          if (seg === "" || seg === ".") continue;
          if (seg === "..") parts.pop();
          else parts.push(seg);
        }
        const path = parts.join("/");
        const html = await zip.file(path)?.async("string");
        if (!html) {
          skipped++;
          continue;
        }
        totalChars += html.length;
        if (totalChars > MAX_TEXT_CHARS) {
          throw new Error(
            `Text is over the ${MAX_TEXT_CHARS.toLocaleString()} character limit — this EPUB is too large to convert in the browser.`
          );
        }
        const blocks = htmlToContent(html);
        if (blocks.length === 0) continue;
        if (content.length > 0 && blocks[0]) {
          blocks[0] = { ...blocks[0], pageBreakBefore: true };
        }
        content.push(...blocks);
      }
      if (content.length === 0) throw new Error("No convertible content found in this EPUB.");

      const blob = await contentToBlob(content, "portrait", file.name.replace(/\.epub$/i, ""));
      const name = file.name.replace(/\.epub$/i, ".pdf");
      downloadBlob(blob, name);
      setResult({ blob, name });
      if (skipped > 0) {
        setError(`Skipped ${skipped} chapter(s) that couldn't be resolved.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Building the PDF failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        {file ? (
          <div className="m-4 rounded-lg border-2 border-dashed p-8 text-center">
            <div className="flex items-center justify-between gap-4">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <Dropzone
            accept=".epub,application/epub+zip"
            onFiles={acceptFile}
            title="Drop an EPUB here"
            subtitle="or click to select a file"
          />
        )}

        {busy && progress && (
          <div className="flex items-center gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {progress}
          </div>
        )}

        {file && (
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
              <Button size="lg" onClick={build} disabled={busy} className="font-semibold">
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Converting…
                  </>
                ) : (
                  <>
                    <BookOpen className="mr-2 size-4" />
                    Convert & download
                  </>
                )}
              </Button>
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
        Chapters are converted in reading order and start on new pages.
        Text-focused: cover images, embedded images, custom fonts and CSS are
        skipped. DRM-protected store books can&apos;t be opened at all.
      </ToolNote>
    </div>
  );
}
