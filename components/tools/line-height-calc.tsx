"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyRow } from "@/components/tools/shared";
import { lineHeightRatio, lineHeightPx } from "@/lib/logic/typography";

export default function LineHeightCalc() {
  const [fontSize, setFontSize] = useState("16");
  const [lineHeight, setLineHeight] = useState("24");
  const [ratio, setRatio] = useState("1.5");

  const fs = Number(fontSize);
  const lh = Number(lineHeight);
  const rt = Number(ratio);

  const computedRatio = fs > 0 ? lineHeightRatio(fs, lh) : null;
  const computedPx = fs > 0 ? lineHeightPx(fs, rt) : null;
  const em = computedRatio !== null ? computedRatio : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="fs">Font size (px)</Label>
          <Input
            id="fs"
            type="number"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lh">Line height (px)</Label>
          <Input
            id="lh"
            type="number"
            value={lineHeight}
            onChange={(e) => setLineHeight(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ratio">Target ratio</Label>
          <Input
            id="ratio"
            type="number"
            step="0.05"
            value={ratio}
            onChange={(e) => setRatio(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {computedRatio !== null && (
          <>
            <CopyRow
              label={`${lh}px line height on ${fs}px`}
              value={`${computedRatio.toFixed(2)} (${(computedRatio * 100).toFixed(0)}%)`}
            />
            {em !== null && (
              <CopyRow label="Line height in em" value={`${em.toFixed(2)}em`} />
            )}
          </>
        )}
        {computedPx !== null && (
          <CopyRow
            label={`${rt} ratio on ${fs}px font`}
            value={`${computedPx.toFixed(2)}px`}
          />
        )}
      </div>

      <div
        className="rounded-lg border p-4"
        style={{ fontSize: `${fs}px`, lineHeight: lh ? `${lh}px` : undefined }}
      >
        The quick brown fox jumps over the lazy dog. Design is how it works and
        how it feels — a good measure keeps lines readable.
      </div>
    </div>
  );
}