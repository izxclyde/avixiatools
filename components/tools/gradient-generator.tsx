"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton } from "@/components/copy-button";
import { ColourInput } from "@/components/tools/shared";
import { randomColour } from "@/lib/logic/colour";

type GradientType = "linear" | "radial" | "conic";

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export default function GradientGenerator() {
  const [type, setType] = useState<GradientType>("linear");
  const [angle, setAngle] = useState(135);
  const [colors, setColors] = useState<string[]>(["#6633ff", "#ff3366"]);

  const updateColor = (index: number, value: string) => {
    setColors((prev) => prev.map((c, i) => (i === index ? value : c)));
  };

  const addColor = () => {
    if (colors.length < 6) setColors((prev) => [...prev, randomColour()]);
  };

  const removeColor = (index: number) => {
    if (colors.length > 2) {
      setColors((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const stops = colors.join(", ");
  const css =
    type === "linear"
      ? `linear-gradient(${angle}deg, ${stops})`
      : type === "radial"
        ? `radial-gradient(circle, ${stops})`
        : `conic-gradient(from ${angle}deg, ${stops})`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Type</Label>
          <Select
            value={type}
            onValueChange={(v) => v && setType(v as GradientType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="radial">Radial</SelectItem>
              <SelectItem value="conic">Conic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type !== "radial" && (
          <div className="grid gap-1.5">
            <Label>Angle</Label>
            <Select
              value={String(angle)}
              onValueChange={(v) => v && setAngle(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANGLES.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}°
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {colors.map((color, i) => (
          <div key={i} className="flex items-end gap-2">
            <ColourInput
              label={`Stop ${i + 1}`}
              value={color}
              onChange={(v) => updateColor(i, v)}
            />
            {colors.length > 2 && (
              <Button variant="ghost" size="sm" onClick={() => removeColor(i)}>
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={addColor} disabled={colors.length >= 6}>
          Add colour
        </Button>
        <Button
          variant="secondary"
          onClick={() => setColors([randomColour(), randomColour()])}
        >
          Random
        </Button>
      </div>

      <div
        className="h-40 rounded-lg border"
        style={{ background: css }}
        aria-label="Gradient preview"
      />

      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <code className="min-w-0 truncate font-mono text-sm">{css}</code>
          <CopyButton value={css} />
        </CardContent>
      </Card>
    </div>
  );
}