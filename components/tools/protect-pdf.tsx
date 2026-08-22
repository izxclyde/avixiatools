"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShareButton } from "@/components/tools/share-button";
import { ToolNote } from "@/components/tools/tool-note";
import { downloadBlob } from "@/lib/download";
import { loadPdfDoc, pdfBlob } from "@/lib/pdf";

export default function ProtectPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  const [allowModifying, setAllowModifying] = useState(false);
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
    setError(null);
    setResult(null);
    setFile(pdf);
  }, []);

  const protect = async () => {
    if (!file || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await loadPdfDoc(await file.arrayBuffer());
      doc.encrypt({
        userPassword: password,
        ...(ownerPassword ? { ownerPassword } : {}),
        permissions: {
          printing: allowPrinting ? "highResolution" : false,
          copying: allowCopying,
          modifying: allowModifying,
        },
      });
      const bytes = await doc.save();
      const blob = pdfBlob(bytes);
      const name = file.name.replace(/\.pdf$/i, "-protected.pdf");
      downloadBlob(blob, name);
      setResult({ blob, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encryption failed.");
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
          <div className="grid gap-x-6 gap-y-4 border-t p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pp-user">Password (required to open)</Label>
              <Input
                id="pp-user"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-owner">Owner password (optional)</Label>
              <Input
                id="pp-owner"
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Defaults to the open password"
              />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <Label>Reader permissions</Label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allowPrinting}
                  onCheckedChange={(v) => setAllowPrinting(!!v)}
                />
                Allow printing
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allowCopying}
                  onCheckedChange={(v) => setAllowCopying(!!v)}
                />
                Allow copying text
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allowModifying}
                  onCheckedChange={(v) => setAllowModifying(!!v)}
                />
                Allow editing content
              </label>
            </div>
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
                  onClick={protect}
                  disabled={busy || !password}
                  className="font-semibold"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Encrypting…
                    </>
                  ) : (
                    "Protect & download"
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
        Files are encrypted with AES-256 in your browser — the password never
        leaves your device and cannot be recovered if lost. Permission flags
        are honoured by most readers, but they are advisory: viewers can choose
        to ignore them.
      </ToolNote>
    </div>
  );
}
