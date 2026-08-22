// File delivery helpers. Downloads always save straight to disk via an
// anchor + blob URL (modern iOS/Android browsers honour the download
// attribute for blob: URLs — data: URLs are the ones iOS ignores).
// Sharing is opt-in through the explicit Share affordance instead of
// hijacking every save with the system share sheet.

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!("share" in navigator) || !navigator.canShare) return false;
  // Probe with a tiny real file: desktop Chrome exposes navigator.share
  // but refuses file sharing, so presence checks alone aren't enough.
  const probe = new File([new Uint8Array([0])], "probe.txt", { type: "text/plain" });
  try {
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Open the native share sheet for a file. Resolves false when sharing is
 * unsupported, the user dismissed the sheet, or it failed for any reason —
 * callers should fall back to downloading.
 */
export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch {
    return false;
  }
}

/** Save straight to disk without any dialog. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Delay revoking: an immediate revoke can abort the download, especially
  // on slower mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
