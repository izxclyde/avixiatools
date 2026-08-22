"use client";

import { useState, useSyncExternalStore, type ComponentProps } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canShareFiles, downloadBlob, shareBlob } from "@/lib/download";

const emptySubscribe = () => () => {};

type ShareButtonProps = {
  blob?: Blob | null;
  filename: string;
} & Omit<ComponentProps<typeof Button>, "onClick">;

// Secondary "send elsewhere" affordance next to a tool's Download button.
// Renders nothing on devices without file-sharing support (most desktops).
// useSyncExternalStore keeps the client-only capability check free of
// hydration mismatches: the server snapshot is always false.
export function ShareButton({ blob, filename, ...buttonProps }: ShareButtonProps) {
  const supported = useSyncExternalStore(emptySubscribe, canShareFiles, () => false);
  const [busy, setBusy] = useState(false);

  if (!supported || !blob) return null;

  const share = async () => {
    setBusy(true);
    const shared = await shareBlob(blob, filename);
    setBusy(false);
    // Sheet dismissed or sharing failed — still deliver the file somehow.
    if (!shared) downloadBlob(blob, filename);
  };

  return (
    <Button
      {...buttonProps}
      onClick={share}
      disabled={busy}
      aria-label={`Share ${filename}`}
      title={`Share ${filename}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
    </Button>
  );
}
