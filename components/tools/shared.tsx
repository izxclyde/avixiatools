"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/copy-button";

// Text input synced with a native colour picker.
export function ColourInput({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const pickerId = `${inputId}-picker`;
  const [pickerValue, setPickerValue] = useState(value);

  return (
    <div className="flex items-end gap-2">
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6633ff"
        />
      </div>
      <Label
        htmlFor={pickerId}
        className="flex h-9 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-card"
        title="Pick colour"
      >
        <input
          id={pickerId}
          type="color"
          value={pickerValue}
          onChange={(e) => {
            setPickerValue(e.target.value);
            onChange(e.target.value);
          }}
          className="h-14 w-14 cursor-pointer border-0 bg-transparent p-0"
        />
      </Label>
    </div>
  );
}

// Monospace value row with a copy button.
export function CopyRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={`truncate text-sm ${mono ? "font-mono" : ""} ${
            value ? "" : "text-muted-foreground"
          }`}
          title={value}
        >
          {value || "—"}
        </div>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}