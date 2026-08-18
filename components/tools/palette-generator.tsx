"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { generatePalette } from "@/lib/logic/colour";

export default function PaletteGenerator() {
  const [palette, setPalette] = useState<string[]>(() => generatePalette());

  const regenerate = () => setPalette(generatePalette());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <Button onClick={regenerate}>Generate</Button>
        <CopyButton value={palette.join(", ")} />
      </div>

      <div className="flex flex-col gap-2">
        {palette.map((color) => (
          <div
            key={color}
            className="flex items-center justify-between rounded-md px-4 py-3"
            style={{ backgroundColor: color }}
          >
            <span className="font-mono text-sm font-semibold text-black">
              {color}
            </span>
            <CopyButton value={color} />
          </div>
        ))}
      </div>

      <div
        className="grid h-24 grid-cols-5 gap-0 overflow-hidden rounded-lg border"
        aria-label="Palette preview"
      >
        {palette.map((color) => (
          <div key={color} style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
}