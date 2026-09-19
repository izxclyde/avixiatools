"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared file-drop target for every tool entry point. One place covers the
// Apple feel rules for all ~24 file tools:
// - Respond on pointer-down, highlight continuously *during* dragover (§1)
// - Keyboard-operable (real button semantics, not a click-only div) (§16)
// - transform/opacity only, reduced-motion safe (§11, §14)
export function Dropzone({
  accept,
  multiple,
  onFiles,
  title,
  subtitle,
  disabled,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList | File[]) => void;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`${title}${subtitle ? `. ${subtitle}` : ""}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "press m-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        "hover:border-muted-foreground/50 hover:bg-muted/50",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        over
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Upload
        className={cn(
          "mx-auto mb-4 size-12 transition-colors",
          over ? "text-primary" : "text-muted-foreground"
        )}
      />
      <p className="text-lg font-medium">{title}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
