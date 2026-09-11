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

// Adapted port of delphitools' background-remover (MIT) — see ACKNOWLEDGEMENTS.md.
// Runs briaai/RMBG-1.4 via @huggingface/transformers; WebGPU with WASM fallback.
// Mobile uses the quantized (~44MB) build + downscaled input so the tab
// isn't killed for memory (full fp32 + 12MP canvas = refresh-with-nothing).

const MOBILE_MAX_SIDE = 800;
const DESKTOP_MAX_SIDE = 1536;

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

// Downscale to a Blob URL (EXIF-aware). Keeps full-res phone photos from
// blowing the tab's memory budget during inference + canvas compositing.
async function fileToDownscaledUrl(
  file: File,
  maxSide: number
): Promise<string> {
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
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) throw new Error("Could not read that image.");
    return URL.createObjectURL(blob);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelineRef = useRef<any>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const mountedRef = useRef(true);
  const objectUrlsRef = useRef<string[]>([]);

  const revokeTrackedUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current = [];
  }, []);

  // Dispose ML pipeline + Blob URLs on unmount to free model memory
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pipelineRef.current?.dispose) {
        pipelineRef.current.dispose();
        pipelineRef.current = null;
      }
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
      objectUrlsRef.current = [];
    };
  }, []);

  const readFile = useCallback(
    async (file: File) => {
      revokeTrackedUrls();
      setSourceImage(null);
      setResultImage(null);
      setResultBlob(null);
      setProcessing({ status: "idle" });
      try {
        const maxSide = isMobileDevice()
          ? MOBILE_MAX_SIDE
          : DESKTOP_MAX_SIDE;
        const url = await fileToDownscaledUrl(file, maxSide);
        if (!mountedRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrlsRef.current.push(url);
        setSourceImage(url);
      } catch (error) {
        if (!mountedRef.current) return;
        setProcessing({ status: "error", message: friendlyError(error) });
      }
    },
    [revokeTrackedUrls]
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

        // WebGPU gets fp16 (~88MB); everything else (all iOS browsers, most
        // phones) gets the quantized WASM build (~44MB). fp32 on WASM is the
        // default-crash: 176MB weights + fp32 runtime OOMs the mobile tab.
        if ("gpu" in navigator) {
          try {
            pipelineRef.current = await pipeline(
              "image-segmentation",
              "briaai/RMBG-1.4",
              {
                device: "webgpu",
                dtype: "fp16",
                progress_callback: progressCallback,
              }
            );
          } catch {
            pipelineRef.current = null;
          }
        }
        if (!pipelineRef.current) {
          try {
            pipelineRef.current = await pipeline(
              "image-segmentation",
              "briaai/RMBG-1.4",
              {
                device: "wasm",
                dtype: "q8",
                progress_callback: progressCallback,
              }
            );
          } catch {
            throw new Error(
              "Model download failed. Check your connection — and if you use Brave Shields or a content blocker, allow huggingface.co, then retry."
            );
          }
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

        const finalImage = await applyMaskToImage(sourceImage, maskImage);
        if (!mountedRef.current) {
          URL.revokeObjectURL(finalImage.url);
          return;
        }
        objectUrlsRef.current.push(finalImage.url);
        setResultBlob(finalImage.blob);
        setResultImage(finalImage.url);
        setProcessing({ status: "done" });

        // On mobile, dispose the pipeline to free WASM heap memory (~44MB+)
        // before the browser decodes and displays the final result <img />.
        if (isMobileDevice() && pipelineRef.current?.dispose) {
          try {
            pipelineRef.current.dispose();
          } catch {
            // ignore
          }
          pipelineRef.current = null;
        }
      } else {
        throw new Error("Processing failed");
      }
    } catch (error) {
      console.error("Background removal failed:", error);
      if (!mountedRef.current) return;
      setProcessing({
        status: "error",
        message: friendlyError(error),
      });
    }
  };

  const applyMaskToImage = async (
    imageUrl: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    maskImage: any
  ): Promise<{ url: string; blob: Blob }> => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const img = await loadImage(imageUrl);

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);
    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      throw new Error(
        "Your device ran out of memory. Try a smaller photo or take a new one at a lower resolution."
      );
    }

    if (
      maskImage &&
      maskImage.data &&
      maskImage.width === img.width &&
      maskImage.height === img.height
    ) {
      // Direct pixel buffer copy — zero extra canvas/image objects
      const maskData = maskImage.data;
      const channels = maskImage.channels || 1;
      for (let i = 0; i < imageData.data.length; i += 4) {
        const maskIdx = Math.floor(i / 4) * channels;
        imageData.data[i + 3] = maskData[maskIdx];
      }
    } else {
      // Fallback path when dimensions differ or mask is URL/Blob
      let maskUrl = "";
      let isBlobUrl = false;

      if (typeof maskImage === "string") {
        maskUrl = maskImage;
      } else if (maskImage instanceof Blob) {
        maskUrl = URL.createObjectURL(maskImage);
        isBlobUrl = true;
      } else if (typeof maskImage?.toDataURL === "function") {
        maskUrl = maskImage.toDataURL();
      } else if (maskImage?.data) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = maskImage.width;
        tempCanvas.height = maskImage.height;
        const tempCtx = tempCanvas.getContext("2d")!;
        const tempImgData = tempCtx.createImageData(
          maskImage.width,
          maskImage.height
        );
        const maskData = maskImage.data;
        for (let i = 0; i < maskData.length; i++) {
          const val = maskData[i];
          tempImgData.data[i * 4] = val;
          tempImgData.data[i * 4 + 1] = val;
          tempImgData.data[i * 4 + 2] = val;
          tempImgData.data[i * 4 + 3] = 255;
        }
        tempCtx.putImageData(tempImgData, 0, 0);
        maskUrl = tempCanvas.toDataURL();
        tempCanvas.width = 0;
        tempCanvas.height = 0;
      }

      try {
        const maskElement = await loadImage(maskUrl);
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = img.width;
        maskCanvas.height = img.height;
        const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true })!;
        maskCtx.drawImage(maskElement, 0, 0, img.width, img.height);
        const maskData = maskCtx.getImageData(0, 0, img.width, img.height);

        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i + 3] = maskData.data[i];
        }

        // Release temporary canvas memory immediately
        maskCanvas.width = 0;
        maskCanvas.height = 0;
      } finally {
        if (isBlobUrl) URL.revokeObjectURL(maskUrl);
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );

    // Immediately zero out main canvas to release GPU texture memory
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
            Mobile mode: uses the smaller ~44MB engine and downsizes photos to
            1024px so it fits in your phone&apos;s memory. Desktop with WebGPU
            gets higher resolution.
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
          your device. On first use, a processing engine is downloaded (about
          44MB on phones, 88MB with WebGPU) and cached for next time. Photos
          are downsized before processing so phones don&apos;t run out of
          memory.
        </p>
      </div>

      {/* Hidden canvas used for mask compositing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
