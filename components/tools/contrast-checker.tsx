"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColourInput } from "@/components/tools/shared";
import { contrastRatio } from "@/lib/logic/colour";

const SWATCHES = ["#ffffff", "#f2f2f2", "#d1d5db", "#374151", "#111111"];

export default function ContrastChecker() {
  const [fg, setFg] = useState("#ffffff");
  const [bg, setBg] = useState("#111111");
  const ratio = contrastRatio(fg, bg);

  const passes = (min: number) => (ratio ?? 0) >= min;

  const checks = [
    { label: "AA — normal text", min: 4.5 },
    { label: "AA — large text", min: 3 },
    { label: "AAA — normal text", min: 7 },
    { label: "AAA — large text", min: 4.5 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <ColourInput label="Foreground" value={fg} onChange={setFg} />
        <ColourInput label="Background" value={bg} onChange={setBg} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setBg(s)}
            className="rounded-md border p-2 text-left"
            style={{ backgroundColor: s }}
          >
            <span className="text-xs text-muted-foreground">Set background {s}</span>
          </button>
        ))}
      </div>

      <div className="flex h-24 items-center justify-center rounded-lg border" style={{ backgroundColor: bg }}>
        <span className="text-2xl font-semibold" style={{ color: fg }}>
          Sample text
        </span>
      </div>

      <div className="text-center">
        <div className="text-5xl font-bold tabular-nums">
          {ratio !== null ? `${ratio.toFixed(2)}:1` : "—"}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">WCAG contrast ratio</p>
      </div>

      <div className="flex flex-col gap-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
          >
            <span className="text-sm">{check.label}</span>
            {ratio === null ? (
              <Badge variant="secondary">invalid colours</Badge>
            ) : passes(check.min) ? (
              <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                Pass
              </Badge>
            ) : (
              <Badge variant="destructive">Fail</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}