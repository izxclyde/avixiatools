"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyRow } from "@/components/tools/shared";
import { convertBase, isValidNumber } from "@/lib/logic/numbers";

const BASES = [2, 8, 10, 16];

export default function BaseConverter() {
  const [value, setValue] = useState("255");
  const [fromBase, setFromBase] = useState(10);

  const valid = isValidNumber(value, fromBase);
  const results: Record<string, string | null> = {
    decimal: valid ? convertBase(value, fromBase, 10) : null,
    hexadecimal: valid ? convertBase(value, fromBase, 16) : null,
    octal: valid ? convertBase(value, fromBase, 8) : null,
    binary: valid ? convertBase(value, fromBase, 2) : null,
  };

  const labelFor: Record<string, string> = {
    decimal: "Decimal (base 10)",
    hexadecimal: "Hexadecimal (base 16)",
    octal: "Octal (base 8)",
    binary: "Binary (base 2)",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="value">Value</Label>
          <Input
            id="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="255"
            className="font-mono"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>From base</Label>
          <Select
            value={String(fromBase)}
            onValueChange={(v) => v && setFromBase(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASES.map((b) => (
                <SelectItem key={b} value={String(b)}>
                  Base {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!valid && (
        <p className="text-sm text-destructive">
          Invalid digits for base {fromBase}.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {Object.entries(results).map(([key, result]) => (
          <CopyRow
            key={key}
            label={labelFor[key]}
            value={result ?? "—"}
          />
        ))}
      </div>
    </div>
  );
}