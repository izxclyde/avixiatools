"use client";

import { Info } from "lucide-react";

// Shared "know before you use this" notice so every tool surfaces its
// limitations up front instead of surprising users mid-task.
export function ToolNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
