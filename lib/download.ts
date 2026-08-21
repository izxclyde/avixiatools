// Share a file via the native share sheet where supported (the reliable
// "Save Image" path on iOS Safari), otherwise fall back to a blob-URL anchor
// download. iOS Safari ignores the download attribute for data: URLs, so
// callers must pass a Blob, never a data URL.
export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      // User dismissed the share sheet — not an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Otherwise fall through to the anchor download.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Delay revoking: an immediate revoke can abort the download in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
