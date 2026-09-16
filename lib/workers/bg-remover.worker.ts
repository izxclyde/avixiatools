import { pipeline, env, RawImage } from "@huggingface/transformers";

// Disable local model lookup and disable browser Cache API (unreliable in some mobile WebViews/Safari)
env.allowLocalModels = false;
env.useBrowserCache = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let segmenter: any = null;

self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "dispose") {
    if (segmenter?.dispose) {
      try {
        await segmenter.dispose();
      } catch {
        // ignore disposal errors
      }
      segmenter = null;
    }
    return;
  }

  if (type === "process") {
    const { imageBlob, preferWebGPU } = event.data;

    try {
      if (!segmenter) {
        self.postMessage({
          type: "progress",
          status: "downloading",
          message: "Downloading engine...",
          progress: 0,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const progressCallback = (pEvent: any) => {
          if (pEvent.status === "progress" && pEvent.progress !== undefined) {
            self.postMessage({
              type: "progress",
              status: "downloading",
              message: "Downloading engine...",
              progress: Math.round(pEvent.progress),
            });
          }
        };

        if (preferWebGPU && typeof navigator !== "undefined" && "gpu" in navigator) {
          try {
            segmenter = await pipeline("image-segmentation", "briaai/RMBG-1.4", {
              device: "webgpu",
              dtype: "fp16",
              progress_callback: progressCallback,
            });
          } catch {
            segmenter = null;
          }
        }

        if (!segmenter) {
          try {
            segmenter = await pipeline("image-segmentation", "briaai/RMBG-1.4", {
              device: "wasm",
              dtype: "q8",
              progress_callback: progressCallback,
            });
          } catch {
            throw new Error(
              "Model download failed. Check your connection — and if you use Brave Shields or a content blocker, allow huggingface.co, then retry."
            );
          }
        }
      }

      self.postMessage({
        type: "progress",
        status: "processing",
        message: "Removing background...",
      });

      const rawImage = await RawImage.read(imageBlob);
      const result = await segmenter(rawImage);

      if (!result || result.length === 0 || !result[0].mask) {
        throw new Error("Processing failed: no mask was produced.");
      }

      const maskImage = result[0].mask;
      const maskData = maskImage.data;
      const width = maskImage.width;
      const height = maskImage.height;
      const channels = maskImage.channels || 1;

      // Extract an isolated ArrayBuffer slice to safely transfer ownership
      const buffer = maskData.buffer.slice(
        maskData.byteOffset,
        maskData.byteOffset + maskData.byteLength
      );

      // Send back the mask data and transfer the ArrayBuffer
      const responseMessage = {
        type: "done",
        mask: {
          data: new Uint8ClampedArray(buffer),
          width,
          height,
          channels,
        },
      };

      try {
        (self as unknown as Worker).postMessage(responseMessage, [buffer]);
      } catch {
        (self as unknown as Worker).postMessage(responseMessage);
      }
    } catch (error) {
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to process image in background worker.",
      });
    }
  }
});
