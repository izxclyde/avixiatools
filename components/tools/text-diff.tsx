"use client";

import { useState } from "react";
import { diffLines } from "diff";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatBox } from "@/components/tools/shared";

export default function TextDiff() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const parts = diffLines(left, right);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="left">Original</Label>
          <Textarea
            id="left"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="Original text…"
            className="min-h-[200px] font-mono text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="right">Modified</Label>
          <Textarea
            id="right"
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder="Modified text…"
            className="min-h-[200px] font-mono text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatBox
          label="Added"
          value={String(parts.filter((p) => p.added).reduce((n, p) => n + p.count!, 0))}
        />
        <StatBox
          label="Removed"
          value={String(parts.filter((p) => p.removed).reduce((n, p) => n + p.count!, 0))}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
          diff
        </div>
        <pre className="max-h-[400px] overflow-auto p-4 font-mono text-sm">
          {parts.map((part, i) => {
            if (part.added) {
              return (
                <span key={i} className="block bg-emerald-500/15 text-emerald-300">
                  + {part.value}
                </span>
              );
            }
            if (part.removed) {
              return (
                <span key={i} className="block bg-red-500/15 text-red-300">
                  - {part.value}
                </span>
              );
            }
            return (
              <span key={i} className="block text-muted-foreground">
                {part.value}
              </span>
            );
          })}
        </pre>
      </div>
    </div>
  );
}