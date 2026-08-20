"use client";

import { Search } from "lucide-react";
import { openCommandPalette } from "@/components/command-palette";

export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="flex w-full max-w-md items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">Search tools…</span>
      <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}