"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { shareOrDownload } from "@/lib/download";
import { createPdfDoc, getPdfLib, imageFileToEmbeddable, pdfBlob } from "@/lib/pdf";

type PageSize = "fit" | "a4" | "letter";

const PAGE_SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const MARGINS: Record<string, number> = { none: 0, small: 24, large: 56 };

export default function JpgToPdf() {
  const [images, setImages] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [margin, setMargin] = useState("small");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const addImages = useCallback((incoming: FileList | File[]) => {
    const imgs = [...incoming].filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      setError("Only image files are supported.");
      return;
    }
    setError(null);
    setImages((prev) => [...prev, ...imgs]);
  }, []);

  const move = (index: number, delta: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const build = async () => {
    if (images.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await createPdfDoc();
      const m = pageSize === "fit" ? 0 : MARGINS[margin];

      for (const file of images) {
        const { data, type } = await imageFileToEmbeddable(file);
        const img = type === "jpg" ? await doc.embedJpg(data) : await doc.embedPng(data);

        if (pageSize === "fit") {
          const page = doc.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          // Landscape when the image is wider than tall
          const [portraitW, portraitH] = PAGE_SIZES[pageSize];
          const [pw, ph] =
            img.width > img.height ? [portraitH, portraitW] : [portraitW, portraitH];
          const page = doc.addPage([pw, ph]);
          const scale = Math.min(
            (pw - 2 * m) / img.width,
            (ph - 2 * m) / img.height
          );
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        }
      }

      const bytes = await doc.save();
      await shareOrDownload(pdfBlob(bytes), "images.pdf");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Building the PDF failed.");
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
            addImages(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className={`m-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            images.length === 0
              ? "cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/50"
              : ""
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={(e) => {
              if (e.target.files) addImages(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
          <Upload className="mx-auto mb-4 size-12 text-muted-foreground" />
          <p className="text-lg font-medium">Drop images here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            JPG, PNG or WebP — select several at once
          </p>
        </div>

        {images.length > 0 && (
          <>
            <ul className="grid grid-cols-3 gap-3 border-t p-4 sm:grid-cols-4 md:grid-cols-5">
              {images.map((file, index) => (
                <li key={`${file.name}-${index}`} className="group relative">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      onLoad={(e) =>
                        URL.revokeObjectURL(e.currentTarget.src)
                      }
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="absolute inset-x-1 bottom-8 flex justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-7"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${file.name} earlier`}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-7"
                      onClick={() => move(index, 1)}
                      disabled={index === images.length - 1}
                      aria-label={`Move ${file.name} later`}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </span>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-1 top-1 size-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => setImages(images.filter((_, i) => i !== index))}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex items-center border-t">
              <input
                ref={addInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                multiple
                onChange={(e) => {
                  if (e.target.files) addImages(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <Button
                variant="ghost"
                onClick={() => addInputRef.current?.click()}
                className="h-auto gap-2 self-stretch rounded-none px-5"
              >
                <Plus className="size-4" />
                Add more
              </Button>
              <Button
                variant="ghost"
                onClick={() => setImages([])}
                className="h-auto gap-2 self-stretch rounded-none px-5"
              >
                <Trash2 className="size-4" />
                Clear all
              </Button>
            </div>
          </>
        )}

        {images.length > 0 && (
          <div className="border-t p-4">
            <div className="mx-auto flex max-w-sm items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label>Page size</Label>
                <Select value={pageSize} onValueChange={(v) => setPageSize(v as PageSize)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">US Letter</SelectItem>
                    <SelectItem value="fit">Fit to image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pageSize !== "fit" && (
                <div className="flex-1 space-y-2">
                  <Label>Margin</Label>
                  <Select value={margin} onValueChange={(v) => v && setMargin(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex border-t">
          <div className="flex flex-1 items-center gap-2 px-4 text-sm text-muted-foreground">
            <ImageIcon className="size-4" />
            {images.length > 0
              ? `${images.length} image${images.length > 1 ? "s" : ""}`
              : "No images yet"}
          </div>
          <Button
            size="lg"
            onClick={build}
            disabled={images.length === 0 || busy}
            className="h-auto self-stretch rounded-none px-8 font-semibold"
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

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
