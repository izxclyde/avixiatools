"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/copy-button";

// State that survives reloads, per tool.
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable
    }
  }, [key, value]);

  return [value, setValue] as const;
}

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

export function FormatterPanel({
  format,
  minify,
  placeholder,
  example,
  storageKey,
}: {
  format: (input: string) => string | null;
  minify: (input: string) => string | null;
  placeholder?: string;
  example?: string;
  storageKey?: string;
}) {
  const [input, setInput] = usePersistedState<string>(storageKey ?? "", "");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const run = (fn: (s: string) => string | null) => {
    if (!input.trim()) {
      setOutput("");
      setError("");
      return;
    }
    const result = fn(input);
    if (result === null) {
      setOutput("");
      setError("Input is not valid — check for syntax errors.");
    } else {
      setOutput(result);
      setError("");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="formatter-input">Input</Label>
        <Textarea
          id="formatter-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="min-h-[200px] font-mono text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => run(format)}>Format</Button>
        <Button variant="outline" onClick={() => run(minify)}>
          Minify
        </Button>
        {example && (
          <Button variant="ghost" onClick={() => setInput(example)}>
            Try an example
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            setInput("");
            setOutput("");
            setError("");
          }}
        >
          Clear
        </Button>
        {output && <CopyButton value={output} />}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {output && (
        <div className="grid gap-1.5">
          <Label htmlFor="formatter-output">Output</Label>
          <Textarea
            id="formatter-output"
            readOnly
            value={output}
            className="min-h-[200px] font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}