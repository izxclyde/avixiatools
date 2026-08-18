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
import {
  TYPO_UNITS,
  convertTypo,
  DEFAULT_BASE,
  type TypoUnit,
} from "@/lib/logic/typography";

export default function TypoCalc() {
  const [value, setValue] = useState("16");
  const [from, setFrom] = useState<TypoUnit>("px");
  const [base, setBase] = useState(String(DEFAULT_BASE));

  const num = Number(value);
  const baseNum = Number(base) || DEFAULT_BASE;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="value">Value</Label>
          <Input
            id="value"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>From</Label>
          <Select
            value={from}
            onValueChange={(v) => v && setFrom(v as TypoUnit)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPO_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="base">Base font size (px)</Label>
          <Input
            id="base"
            type="number"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {TYPO_UNITS.map((unit) => {
          if (unit === from) return null;
          const result = Number.isFinite(num)
            ? convertTypo(num, from, unit, baseNum)
            : null;
          return (
            <CopyRow
              key={unit}
              label={`${num}${from} → ${unit}`}
              value={result !== null ? result.toFixed(4) : "—"}
            />
          );
        })}
      </div>
    </div>
  );
}