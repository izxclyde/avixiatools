"use client";

import { useState, useCallback, useRef, useEffect, useSyncExternalStore } from "react";
import {
  Upload,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  Info,
  MonitorSmartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilePaste } from "@/hooks/use-file-paste";
import { downloadBlob } from "@/lib/download";
import { ShareButton } from "@/components/tools/share-button";

// Enhanced background remover:
// Runs briaai/RMBG-1.4 via dedicated Web Worker (WebGPU with WASM fallback).
// On mobile, offloads ML execution off the main UI thread to prevent stutter,
// runs inference on an 800px thumbnail to stay within memory limits, and applies
// the high-quality mask to a high-resolution version (up to 2048px on mobile).

const INFERENCE_MAX_SIDE = 800;
const MOBILE_OUTPUT_MAX_SIDE = 2048;
const DESKTOP_OUTPUT_MAX_SIDE = 2560;

interface ProcessingState {
  status: "idle" | "downloading" | "processing" | "done" | "error";
  message?: string;
  progress?: number; // 0-100
}

interface SupportInfo {
  checked: boolean;
  supported: boolean;
  reason?: string;
  mobile: boolean;
  hasWebGPU: boolean;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    (typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches)
  );
}

function getSupportInfo(): SupportInfo {
  const mobile = isMobileDevice();
  const hasWebGPU =
    typeof navigator !== "undefined" && "gpu" in navigator;
  if (typeof WebAssembly === "undefined") {
    return {
      checked: true,
      supported: false,
      reason:
        "This browser doesn't support WebAssembly, which the on-device engine needs.",
      mobile,
      hasWebGPU,
    };
  }
  if (typeof Worker === "undefined") {
    return {
      checked: true,
      supported: false,
      reason:
        "This browser doesn't support Web Workers, which are required for processing.",
      mobile,
      hasWebGPU,
    };
  }
  try {
    const canvas = document.createElement("canvas");
    if (
      !canvas.getContext("2d") ||
      typeof URL?.createObjectURL !== "function" ||
      typeof createImageBitmap === "undefined"
    ) {
      throw new Error("missing canvas/image APIs");
    }
  } catch {
    return {
      checked: true,
      supported: false,
      reason:
        "This browser is missing the image processing features this tool needs. Try a recent version of Safari, Chrome, Edge, or Firefox.",
      mobile,
      hasWebGPU,
    };
  }
  return { checked: true, supported: true, mobile, hasWebGPU };
}

const emptySubscribe = () => () => {};
const serverSupportSnapshot: SupportInfo = {
  checked: false,
  supported: true,
  mobile: false,
  hasWebGPU: false,
};
let cachedSupportSnapshot: SupportInfo | null = null;
function getSupportSnapshot(): SupportInfo {
  if (!cachedSupportSnapshot) cachedSupportSnapshot = getSupportInfo();
  return cachedSupportSnapshot;
}
function getServerSupportSnapshot(): SupportInfo {
  return serverSupportSnapshot;
}

function friendlyError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Failed to process image";
  if (/heic|heif/i.test(message)) return message;
  if (/out of memory|memory|allocation failed/i.test(message)) {
    return "Your device ran out of memory. Try a smaller photo or take a new one at a lower resolution.";
  }
  if (
    /huggingface|shields|fetch|network|load model|download|failed to fetch/i.test(
      message
    )
  ) {
    return "Model download failed. Check your connection — and if you use Brave Shields or a content blocker, allow huggingface.co, then retry.";
  }
  return message;
}

interface PreparedPreview {
  previewUrl: string;
  inferenceBlob: Blob;
}

// Generate a lightweight downscaled thumbnail (max 800px) specifically for UI preview
// and ML inference. Keeps memory usage minimal during model download on mobile.
async function preparePreviewAndInference(
  file: File
): Promise<PreparedPreview> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
  } catch {
    throw new Error(
      "Could not read that image. iPhone HEIC photos aren't supported — convert it to JPG or PNG first."
    );
  }

  try {
    const origWidth = bitmap.width;
    const origHeight = bitmap.height;

    // Single downscaled canvas for preview and ML inference (max 800px)
    const infScale = Math.min(1, INFERENCE_MAX_SIDE / Math.max(origWidth, origHeight));
    const infWidth = Math.max(1, Math.round(origWidth * infScale));
    const infHeight = Math.max(1, Math.round(origHeight * infScale));

    const canvas = document.createElement("canvas");
    canvas.width = infWidth;
    canvas.height = infHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, infWidth, infHeight);

    const isPng = file.type === "image/png";
    const inferenceBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, isPng ? "image/png" : "image/jpeg", 0.90)
    );

    // Release canvas memory immediately
    canvas.width = 0;
    canvas.height = 0;

    if (!inferenceBlob) throw new Error("Could not process image for engine.");

    const previewUrl = URL.createObjectURL(inferenceBlob);

    return {
      previewUrl,
      inferenceBlob,
    };
  } finally {
    bitmap.close();
  }
}

export default function BackgroundRemover() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    status: "idle",
  });
  // Same hydration-safe pattern as ShareButton: server snapshot is always
  // "unchecked", client snapshot computes once and caches.
  const support = useSyncExternalStore(
    emptySubscribe,
    getSupportSnapshot,
    getServerSupportSnapshot
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileRef = useRef<File | null>(null);
  const inferenceBlobRef = useRef<Blob | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const mountedRef = useRef(true);
  const objectUrlsRef = useRef<string[]>([]);

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../../lib/workers/bg-remover.worker.ts", import.meta.url),
        { type: "module" }
      );
    }
    return workerRef.current;
  }, []);

  const revokeTrackedUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current = [];
  }, []);

  // Terminate worker & revoke Blob URLs on unmount to free all model/worker memory
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      terminateWorker();
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
      objectUrlsRef.current = [];
    };
  }, [terminateWorker]);

  const readFile = useCallback(
    async (file: File) => {
      terminateWorker();
      fileRef.current = file;
      inferenceBlobRef.current = null;
      revokeTrackedUrls();
      setSourceImage(null);
      setResultImage(null);
      setResultBlob(null);
      setProcessing({ status: "idle" });
      try {
        const prepared = await preparePreviewAndInference(file);
        if (!mountedRef.current) {
          URL.revokeObjectURL(prepared.previewUrl);
          return;
        }
        inferenceBlobRef.current = prepared.inferenceBlob;
        objectUrlsRef.current.push(prepared.previewUrl);
        setSourceImage(prepared.previewUrl);
      } catch (error) {
        if (!mountedRef.current) return;
        setProcessing({ status: "error", message: friendlyError(error) });
      }
    },
    [revokeTrackedUrls, terminateWorker]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        void readFile(file);
      }
    },
    [readFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      void readFile(file);
    }
  };

  useFilePaste(readFile, "image/*");

  const removeBackground = async () => {
    if (!sourceImage || !inferenceBlobRef.current) return;

    try {
      const worker = getWorker();

      setProcessing({
        status: "downloading",
        message: "Initializing engine...",
        progress: 0,
      });

      worker.onmessage = async (event: MessageEvent) => {
        if (!mountedRef.current) return;
        const data = event.data;

        if (data.type === "progress") {
          setProcessing({
            status: data.status,
            message: data.message,
            progress: data.progress,
          });
        } else if (data.type === "done") {
          try {
            // On mobile, terminate worker BEFORE high-res canvas compositing
            // to immediately reclaim ~44MB+ WASM memory before allocating the 2048px canvas!
            if (isMobileDevice()) {
              terminateWorker();
            }

            setProcessing({
              status: "processing",
              message: "Applying high-resolution mask...",
            });

            const source = fileRef.current || sourceImage;
            const finalImage = await applyMaskToSource(
              source,
              data.mask,
              isMobileDevice()
            );

            if (!mountedRef.current) {
              URL.revokeObjectURL(finalImage.url);
              return;
            }

            objectUrlsRef.current.push(finalImage.url);
            setResultBlob(finalImage.blob);
            setResultImage(finalImage.url);
            setProcessing({ status: "done" });
          } catch (error) {
            setProcessing({
              status: "error",
              message: friendlyError(error),
            });
          }
        } else if (data.type === "error") {
          if (!mountedRef.current) return;
          setProcessing({
            status: "error",
            message: friendlyError(new Error(data.error)),
          });
        }
      };

      worker.onerror = (err) => {
        console.error("Worker error:", err);
        if (!mountedRef.current) return;
        setProcessing({
          status: "error",
          message: "An error occurred in the background processing worker.",
        });
      };

      worker.postMessage({
        type: "process",
        imageBlob: inferenceBlobRef.current,
        preferWebGPU: support.hasWebGPU,
      });
    } catch (error) {
      console.error("Background removal failed:", error);
      if (!mountedRef.current) return;
      setProcessing({
        status: "error",
        message: friendlyError(error),
      });
    }
  };

  const applyMaskToSource = async (
    source: File | string,
    mask: {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      channels?: number;
    },
    isMobile: boolean
  ): Promise<{ url: string; blob: Blob }> => {
    const canvas = canvasRef.current || document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    let imgWidth = 0;
    let imgHeight = 0;

    if (source instanceof File) {
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(source, {
          imageOrientation: "from-image",
        } as ImageBitmapOptions);
      } catch {
        throw new Error(
          "Could not read that image. iPhone HEIC photos aren't supported — convert it to JPG or PNG first."
        );
      }

      try {
        const origWidth = bitmap.width;
        const origHeight = bitmap.height;
        const maxOutputSide = isMobile
          ? MOBILE_OUTPUT_MAX_SIDE
          : DESKTOP_OUTPUT_MAX_SIDE;
        const outputScale = Math.min(
          1,
          maxOutputSide / Math.max(origWidth, origHeight)
        );
        imgWidth = Math.max(1, Math.round(origWidth * outputScale));
        imgHeight = Math.max(1, Math.round(origHeight * outputScale));

        canvas.width = imgWidth;
        canvas.height = imgHeight;
        ctx.drawImage(bitmap, 0, 0, imgWidth, imgHeight);
      } finally {
        bitmap.close();
      }
    } else {
      const img = await loadImage(source);
      imgWidth = img.width;
      imgHeight = img.height;
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
    }

    // 1. Create a mask canvas matching the raw mask dimensions
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = mask.width;
    maskCanvas.height = mask.height;
    const maskCtx = maskCanvas.getContext("2d")!;
    const maskImgData = maskCtx.createImageData(mask.width, mask.height);

    const maskData = mask.data;
    const channels = mask.channels || 1;
    const totalPixels = mask.width * mask.height;

    // Direct assignment to Alpha channel (index 3) so destination-in can use it
    for (let p = 0; p < totalPixels; p++) {
      maskImgData.data[p * 4 + 3] = maskData[p * channels];
    }
    maskCtx.putImageData(maskImgData, 0, 0);

    // 2. High-resolution compositing canvas
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(maskCanvas, 0, 0, imgWidth, imgHeight);
    ctx.restore();

    // Release temporary mask canvas
    maskCanvas.width = 0;
    maskCanvas.height = 0;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );

    // Zero out main canvas to release GPU texture memory
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) throw new Error("Failed to encode PNG");
    return { url: URL.createObjectURL(blob), blob };
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const downloadResult = () => {
    if (!resultBlob) return;
    downloadBlob(resultBlob, "background-removed.png");
  };

  const clearImage = () => {
    terminateWorker();
    fileRef.current = null;
    inferenceBlobRef.current = null;
    revokeTrackedUrls();
    setSourceImage(null);
    setResultImage(null);
    setResultBlob(null);
    setProcessing({ status: "idle" });
  };

  const isProcessing =
    processing.status === "downloading" || processing.status === "processing";

  if (support.checked && !support.supported) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-8 text-center">
          <MonitorSmartphone className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Not supported in this browser</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {support.reason}
          </p>
          <div className="mx-auto mt-4 max-w-md text-left text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What you can do:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Open this page in a recent Safari, Chrome, Edge, or Firefox.</li>
              <li>On iPhone, use Safari — all other iOS browsers are limited by the system.</li>
              <li>Convert HEIC photos to JPG or PNG before uploading.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {support.checked && support.mobile && !support.hasWebGPU && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Mobile enhanced: offloads processing to a background worker to keep your phone responsive and outputs up to 2048px high-resolution images.
          </p>
        </div>
      )}
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
              or click to select a file, or paste (JPG/PNG — HEIC isn&apos;t
              supported)
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
            <div className="flex flex-col sm:min-h-14 sm:flex-row sm:items-stretch">
              <h3 className="flex flex-1 items-center px-4 py-3 font-semibold sm:py-0">
                Result
              </h3>
              <div className="flex border-t sm:border-t-0">
                <Button
                  variant="ghost"
                  onClick={clearImage}
                  className="h-auto flex-1 gap-2 self-stretch rounded-none border-l px-5 py-3 first:border-l-0 sm:flex-none sm:first:border-l sm:py-0"
                >
                  <Trash2 className="size-4" />
                  Clear
                </Button>
                <ShareButton
                  blob={resultBlob}
                  filename="background-removed.png"
                  variant="ghost"
                  className="h-auto self-stretch rounded-none border-l px-5 py-3 sm:py-0"
                />
                <Button
                  onClick={downloadResult}
                  className="h-auto flex-1 gap-2 self-stretch rounded-none border-l px-6 py-3 font-semibold sm:flex-none sm:py-0"
                >
                  <Download className="size-4" />
                  Download PNG
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 border-t sm:grid-cols-2">
              <div className="border-b sm:border-r sm:border-b-0">
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
          your device. Operations run in a background worker to ensure
          a smooth UI, and high-resolution output (up to 2048px on mobile) is generated via
          mask upscaling without overloading device memory.
        </p>
      </div>

      {/* Hidden canvas used for mask compositing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
