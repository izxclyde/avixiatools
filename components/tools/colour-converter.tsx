"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ColourInput, CopyRow } from "@/components/tools/shared";
import { parseColour, COLOUR_FORMATS, type ColourFormat } from "@/lib/logic/colour";

const PRESETS = [
  "#6633ff",
  "#ff3366",
  "#00c2a8",
  "#ff9900",
  "#3366ff",
  "#22d3ee",
  "#f59e0b",
  "#ec4899",
];

export default function ColourConverter() {
  const [input, setInput] = useState("#6633ff");
  const parsed = parseColour(input);

  return (
    <div className="flex flex-col gap-6">
      <ColourInput label="Colour" value={input} onChange={setInput} />

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setInput(c)}
            className="h-8 w-8 rounded-md border transition-transform hover:scale-110"
            style={{ backgroundColor: c }}
            aria-label={`Use ${c}`}
          />
        ))}
      </div>

      <div
        className="h-20 rounded-lg border"
        style={{ backgroundColor: input }}
        aria-hidden="true"
      />

      {parsed ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            {COLOUR_FORMATS.map((format) => (
              <CopyRow
                key={format}
                label={format.toUpperCase()}
                value={parsed[format as ColourFormat]}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter a valid colour — hex, rgb(), hsl(), oklch(), lab(), lch(), or a
          named colour.
        </p>
      )}
    </div>
  );
}