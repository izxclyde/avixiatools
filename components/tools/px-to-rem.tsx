"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyRow } from "@/components/tools/shared";
import { pxToRem, remToPx, DEFAULT_BASE } from "@/lib/logic/typography";

export default function PxToRem() {
  const [base, setBase] = useState(String(DEFAULT_BASE));
  const [px, setPx] = useState("16");
  const [rem, setRem] = useState("1");

  const baseNum = Number(base) || DEFAULT_BASE;
  const pxNum = Number(px);
  const remNum = Number(rem);
  const pxFromRem = Number.isFinite(remNum) ? remToPx(remNum, baseNum) : null;
  const remFromPx = Number.isFinite(pxNum) ? pxToRem(pxNum, baseNum) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="base">Root font size (px)</Label>
          <Input
            id="base"
            type="number"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="px">Pixels</Label>
          <Input
            id="px"
            type="number"
            value={px}
            onChange={(e) => setPx(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rem">Rem</Label>
          <Input
            id="rem"
            type="number"
            step="0.01"
            value={rem}
            onChange={(e) => setRem(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {remFromPx !== null && (
          <CopyRow label={`${pxNum}px → rem`} value={remFromPx.toFixed(4)} />
        )}
        {pxFromRem !== null && (
          <CopyRow label={`${remNum}rem → px`} value={String(pxFromRem)} />
        )}
      </div>
    </div>
  );
}