"use client";

import { useEffect, useId, useMemo, useState } from "react";
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
  const long = value.length > 12;
  return (
    <div className="min-w-0 rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        title={value}
        className={`mt-0.5 font-semibold tabular-nums ${
          long ? "break-all text-sm" : "text-2xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function FormatterPanel({
  format,
  minify,
  placeholder,
  example,
  storageKey,
  renderOutput,
  describe,
}: {
  format: (input: string) => string | null;
  minify?: (input: string) => string | null;
  placeholder?: string;
  example?: string;
  storageKey?: string;
  renderOutput?: (output: string, isMinified: boolean) => React.ReactNode;
  describe?: (input: string) => string | null;
}) {
  const [input, setInput] = usePersistedState<string>(storageKey ?? "", "");
  const [output, setOutput] = useState("");
  const [isMinified, setIsMinified] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");

  const renderedOutput = useMemo(
    () => (renderOutput && output ? renderOutput(output, isMinified) : null),
    [renderOutput, output, isMinified]
  );

  const live = useMemo(() => {
    if (!input.trim()) return { state: "idle" as const, text: "Waiting for input." };
    const detail = describe?.(input);
    if (detail !== undefined && detail !== null)
      return { state: "valid" as const, text: detail };
    const ok = format(input) !== null;
    return ok
      ? { state: "valid" as const, text: `${input.length} characters · valid syntax.` }
      : { state: "invalid" as const, text: "Not valid yet — check for syntax errors." };
  }, [input, format, describe]);

  const run = (fn: (s: string) => string | null, minifying = false) => {
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
      // Multimodal commit feedback (§13) — same frame as the visual update,
      // meaningful moments only; silently skipped where unsupported.
      try {
        navigator.vibrate?.(10);
      } catch {
        // non-fatal
      }
      setIsMinified(minifying);
      if (minifying) {
        setViewMode("raw");
      } else {
        setViewMode("tree");
      }
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
          aria-describedby="formatter-status"
          aria-invalid={live.state === "invalid"}
        />
        <p
          id="formatter-status"
          role="status"
          aria-live="polite"
          className={`text-sm ${
            live.state === "valid"
              ? "text-muted-foreground"
              : live.state === "invalid"
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${
              live.state === "valid"
                ? "bg-emerald-500"
                : live.state === "invalid"
                  ? "bg-destructive"
                  : "bg-muted-foreground/40"
            }`}
          />
          {live.state === "valid" ? `Valid · ${live.text}` : live.text}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => run(format, false)}>Format</Button>
        {minify && (
          <Button variant="outline" onClick={() => run(minify, true)}>
            Minify
          </Button>
        )}
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
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="formatter-output">Output</Label>
            {renderOutput && (
              <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("tree")}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    viewMode === "tree"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={viewMode === "tree"}
                >
                  Interactive Tree
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("raw")}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    viewMode === "raw"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={viewMode === "raw"}
                >
                  Raw Text
                </button>
              </div>
            )}
          </div>

          {renderOutput && viewMode === "tree" ? (
            renderedOutput ?? (
              <Textarea
                id="formatter-output"
                readOnly
                value={output}
                className="min-h-[200px] font-mono text-sm"
              />
            )
          ) : (
            <Textarea
              id="formatter-output"
              readOnly
              value={output}
              className="min-h-[200px] font-mono text-sm"
            />
          )}
        </div>
      )}
    </div>
  );
}