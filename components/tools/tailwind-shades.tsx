"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { ColourInput, CopyRow } from "@/components/tools/shared";
import { generateShades, SHADE_STEPS } from "@/lib/logic/colour";

export default function TailwindShades() {
  const [base, setBase] = useState("#6633ff");
  const shades = generateShades(base);

  const scaleCss = Object.entries(shades)
    .map(([step, hex]) => `  ${step}: ${hex};`)
    .join("\n");
  const block = `:root {\n${scaleCss}\n}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-2">
        <ColourInput label="Base colour" value={base} onChange={setBase} />
        <Button variant="secondary" onClick={() => setBase("#000000")}>
          Reset
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {SHADE_STEPS.map((step) => (
          <div
            key={step}
            className="flex items-center justify-between rounded-md px-3 py-2"
            style={{ backgroundColor: shades[step] }}
          >
            <span
              className="font-mono text-xs font-semibold tabular-nums"
              style={{ color: Number(step) >= 500 ? "#fff" : "#000" }}
            >
              {step}
            </span>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-xs tabular-nums"
                style={{ color: Number(step) >= 500 ? "#fff" : "#000" }}
              >
                {shades[step]}
              </span>
              <CopyButton value={shades[step]} />
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <pre className="min-w-0 overflow-x-auto font-mono text-xs">{block}</pre>
          <CopyButton value={block} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {SHADE_STEPS.slice(0, 5).map((step) => (
          <CopyRow key={step} label={`shades-${step}`} value={shades[step]} />
        ))}
      </div>
    </div>
  );
}