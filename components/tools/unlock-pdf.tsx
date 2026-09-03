"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { downloadBlob } from "@/lib/download";
import { checkPdfFile, outputName } from "@/lib/logic/pdf";
import { createPdfDoc, getPdfLib, pdfBlob } from "@/lib/pdf";

export default function UnlockPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((incoming: FileList | File[]) => {
    const pdf = [...incoming].find(
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
  }, []);

  const unlock = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { PDFDocument } = await getPdfLib();
      // Decrypts with the given password; a wrong password throws
      let src;
      try {
        src = await PDFDocument.load(await file.arrayBuffer(), {
          password,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/incorrect|password/i.test(msg)) {
          setError("Couldn't decrypt this PDF — the password looks wrong.");
        } else {
          setError("Couldn't read this file — it may be corrupt or not a real PDF.");
        }
        return;
      }
      // Saving the loaded doc preserves its encryption, so copy pages
      // into a fresh document to produce a genuinely unlocked file.
      const out = await createPdfDoc();
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((page) => out.addPage(page));
      const bytes = await out.save();
      const blob = pdfBlob(bytes);
      const name = outputName(file.name, "-unlocked");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decryption failed.");
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
                  setPassword("");
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Clear
              </Button>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-4 size-12 text-muted-foreground" />
              <p className="text-lg font-medium">Drop an encrypted PDF here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                or click to select a file
              </p>
            </>
          )}
        </div>

        {file && (
          <div className="space-y-2 border-t p-4">
            <Label htmlFor="up-password">Password</Label>
            <Input
              id="up-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              placeholder="The document's open or owner password"
              onKeyDown={(e) => e.key === "Enter" && unlock()}
            />
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
                <ShareButton
                  blob={result?.blob}
                  filename={result?.name ?? ""}
                  variant="outline"
                  className="font-semibold"
                />
                <Button
                  size="lg"
                  onClick={unlock}
                  disabled={busy || !password}
                  className="font-semibold"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Unlocking…
                    </>
                  ) : (
                    "Unlock & download"
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
        You need to know the document&apos;s password — this tool removes
        protection from files you own, it doesn&apos;t crack passwords.
        Decryption happens locally; the file and password never leave your
        device.
      </ToolNote>
    </div>
  );
}
