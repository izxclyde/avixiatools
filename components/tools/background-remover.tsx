"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilePaste } from "@/hooks/use-file-paste";

// Adapted port of delphitools' background-remover (MIT) — see ACKNOWLEDGEMENTS.md.
// Runs briaai/RMBG-1.4 via @huggingface/transformers; WebGPU with WASM fallback.

interface ProcessingState {
  status: "idle" | "downloading" | "processing" | "done" | "error";
  message?: string;
  progress?: number; // 0-100
}

export default function BackgroundRemover() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    status: "idle",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelineRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Dispose ML pipeline on unmount to free model memory
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pipelineRef.current?.dispose) {
        pipelineRef.current.dispose();
        pipelineRef.current = null;
      }
    };
  }, []);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImage(e.target?.result as string);
      setResultImage(null);
      setProcessing({ status: "idle" });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      readFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      readFile(file);
    }
  };

  useFilePaste(readFile, "image/*");

  const removeBackground = async () => {
    if (!sourceImage) return;

    try {
      if (!pipelineRef.current) {
        setProcessing({
          status: "downloading",
          message: "Downloading engine...",
          progress: 0,
        });

        const { pipeline, env } = await import("@huggingface/transformers");

        env.allowLocalModels = false;
        // Disable Transformers.js Cache API — use the browser's HTTP cache
        // instead; the Cache API is unreliable on iOS Safari.
        env.useBrowserCache = false;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const progressCallback = (event: any) => {
          if (event.status === "progress" && event.progress !== undefined) {
            setProcessing({
              status: "downloading",
              message: "Downloading engine...",
              progress: Math.round(event.progress),
            });
          }
        };

        try {
          pipelineRef.current = await pipeline(
            "image-segmentation",
            "briaai/RMBG-1.4",
            {
              device: "webgpu",
              dtype: "fp32",
              progress_callback: progressCallback,
            }
          );
        } catch {
          pipelineRef.current = await pipeline(
            "image-segmentation",
            "briaai/RMBG-1.4",
            {
              device: "wasm",
              dtype: "fp32",
              progress_callback: progressCallback,
            }
          );
        }

        // Component unmounted while the model was downloading — free it and bail.
        if (!mountedRef.current) {
          pipelineRef.current?.dispose?.();
          pipelineRef.current = null;
          return;
        }
      }

      setProcessing({ status: "processing", message: "Removing background..." });

      const result = await pipelineRef.current(sourceImage);

      if (!mountedRef.current) return;

      if (result && result.length > 0 && result[0].mask) {
        const maskImage = result[0].mask;

        let maskDataUrl: string;
        let isBlobUrl = false;
        if (typeof maskImage.toDataURL === "function") {
          maskDataUrl = maskImage.toDataURL();
        } else if (maskImage instanceof Blob) {
          maskDataUrl = URL.createObjectURL(maskImage);
          isBlobUrl = true;
        } else if (typeof maskImage === "string") {
          maskDataUrl = maskImage;
        } else {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = maskImage.width;
          tempCanvas.height = maskImage.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          const imageData = tempCtx.createImageData(
            maskImage.width,
            maskImage.height
          );

          const maskData = maskImage.data;
          for (let i = 0; i < maskData.length; i++) {
            const val = maskData[i];
            imageData.data[i * 4] = val;
            imageData.data[i * 4 + 1] = val;
            imageData.data[i * 4 + 2] = val;
            imageData.data[i * 4 + 3] = 255;
          }
          tempCtx.putImageData(imageData, 0, 0);
          maskDataUrl = tempCanvas.toDataURL();
        }

        try {
          const finalImage = await applyMaskToImage(sourceImage, maskDataUrl);
          if (!mountedRef.current) return;
          setResultImage(finalImage);
          setProcessing({ status: "done" });
        } finally {
          if (isBlobUrl) {
            URL.revokeObjectURL(maskDataUrl);
          }
        }
      } else {
        throw new Error("Processing failed");
      }
    } catch (error) {
      console.error("Background removal failed:", error);
      if (!mountedRef.current) return;
      setProcessing({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to process image",
      });
    }
  };

  const applyMaskToImage = async (
    imageUrl: string,
    maskUrl: string
  ): Promise<string> => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const [img, mask] = await Promise.all([
      loadImage(imageUrl),
      loadImage(maskUrl),
    ]);

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = img.width;
    maskCanvas.height = img.height;
    const maskCtx = maskCanvas.getContext("2d")!;
    maskCtx.drawImage(mask, 0, 0, img.width, img.height);
    const maskData = maskCtx.getImageData(0, 0, img.width, img.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i + 3] = maskData.data[i];
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const link = document.createElement("a");
    link.download = "background-removed.png";
    link.href = resultImage;
    link.click();
  };

  const clearImage = () => {
    setSourceImage(null);
    setResultImage(null);
    setProcessing({ status: "idle" });
  };

  const isProcessing =
    processing.status === "downloading" || processing.status === "processing";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        {!sourceImage ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="m-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
            onClick={() =>
              document.getElementById("bg-remover-input")?.click()
            }
          >
            <input
              id="bg-remover-input"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="text-lg font-medium">Drop an image here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to select a file, or paste
            </p>
          </div>
        ) : !resultImage ? (
          <div>
            <div className="flex items-center justify-between p-4">
              <h3 className="font-semibold">Your Image</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearImage}
                disabled={isProcessing}
              >
                <Trash2 className="mr-2 size-4" />
                Clear
              </Button>
            </div>
            <div
              className="relative cursor-pointer overflow-hidden rounded-b-lg border-t bg-muted"
              onClick={() =>
                !isProcessing &&
                document.getElementById("bg-remover-source")?.click()
              }
            >
              <input
                id="bg-remover-source"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <img
                src={sourceImage}
                alt="Source"
                className="mx-auto max-h-80 max-w-full object-contain"
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="flex min-h-14 items-stretch">
              <h3 className="flex flex-1 items-center px-4 font-semibold">
                Result
              </h3>
              <Button
                variant="ghost"
                onClick={clearImage}
                className="h-auto gap-2 self-stretch rounded-none border-l px-5"
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
              <Button
                onClick={downloadResult}
                className="h-auto gap-2 self-stretch rounded-none border-l px-6 font-semibold"
              >
                <Download className="size-4" />
                Download PNG
              </Button>
            </div>
            <div className="grid grid-cols-2 border-t">
              <div className="border-r">
                <p className="border-b p-2 text-center text-sm text-muted-foreground">
                  Original
                </p>
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted">
                  <img
                    src={sourceImage}
                    alt="Original"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
              <div>
                <p className="border-b p-2 text-center text-sm text-muted-foreground">
                  Background Removed
                </p>
                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                  <img
                    src={resultImage}
                    alt="Background removed"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {sourceImage && !resultImage && (
          <div className="border-t">
            <Button
              size="lg"
              className="h-14 w-full rounded-none text-lg font-bold"
              onClick={removeBackground}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  {processing.message}
                  {processing.status === "downloading" &&
                    processing.progress !== undefined && (
                      <span className="ml-1">{processing.progress}%</span>
                    )}
                </>
              ) : (
                "Remove Background"
              )}
            </Button>
            {processing.status === "downloading" &&
              processing.progress !== undefined && (
                <div className="h-2 w-full overflow-hidden border-t bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${processing.progress}%` }}
                  />
                </div>
              )}
          </div>
        )}
      </div>

      {processing.status === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Error</p>
            <p className="text-sm text-muted-foreground">{processing.message}</p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Processing happens entirely in your browser — your image never leaves
          your device. On first use, a ~180MB processing engine is downloaded
          and cached for next time.
        </p>
      </div>

      {/* Hidden canvas used for mask compositing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
