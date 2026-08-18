"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyRow } from "@/components/tools/shared";
import { UNIT_CATEGORIES, convertUnit, type UnitCategory } from "@/lib/logic/units";

const pretty = (v: number) =>
  Number.isFinite(v)
    ? v.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : "—";

export default function UnitConverter() {
  const [categoryId, setCategoryId] = useState("length");
  const [value, setValue] = useState("1");
  const [from, setFrom] = useState("km");
  const [to, setTo] = useState("m");

  const category: UnitCategory =
    UNIT_CATEGORIES.find((c) => c.id === categoryId) ?? UNIT_CATEGORIES[0];

  const changeCategory = (id: string) => {
    const next = UNIT_CATEGORIES.find((c) => c.id === id)!;
    setCategoryId(id);
    setFrom(next.units[0].name);
    setTo(next.units[1].name);
  };

  const num = Number(value);
  const result =
    Number.isFinite(num) && num !== null
      ? convertUnit(category, num, from, to)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label>Category</Label>
          <Select
            value={categoryId}
            onValueChange={(v) => v && changeCategory(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          <Select value={from} onValueChange={(v) => v && setFrom(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {category.units.map((u) => (
                <SelectItem key={u.name} value={u.name}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>To</Label>
          <Select value={to} onValueChange={(v) => v && setTo(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {category.units.map((u) => (
                <SelectItem key={u.name} value={u.name}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {category.units.map((unit) => {
          if (unit.name === from || result === null) return null;
          return (
            <CopyRow
              key={unit.name}
              label={`${pretty(num)} ${from} → ${unit.name}`}
              value={pretty(convertUnit(category, num, from, unit.name))}
            />
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          Swap units
        </Button>
      </div>
    </div>
  );
}