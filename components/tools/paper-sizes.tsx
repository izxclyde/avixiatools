"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Paper = { name: string; w: number; h: number };
type Series = "A" | "B" | "C" | "US";

const ISO: Record<string, Record<string, [number, number]>> = {
  A: {
    A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420],
    A4: [210, 297], A5: [148, 210], A6: [105, 148], A7: [74, 105],
    A8: [52, 74], A9: [37, 52], A10: [26, 37],
  },
  B: {
    B0: [1000, 1414], B1: [707, 1000], B2: [500, 707], B3: [353, 500],
    B4: [250, 353], B5: [176, 250], B6: [125, 176], B7: [88, 125],
    B8: [62, 88], B9: [44, 62], B10: [31, 44],
  },
  C: {
    C0: [917, 1297], C1: [648, 917], C2: [458, 648], C3: [324, 458],
    C4: [229, 324], C5: [162, 229], C6: [114, 162], C7: [81, 114],
    C8: [57, 81], C9: [40, 57], C10: [28, 40],
  },
};

const US: Paper[] = [
  { name: "Letter", w: 215.9, h: 279.4 },
  { name: "Legal", w: 215.9, h: 355.6 },
  { name: "Tabloid", w: 279.4, h: 431.8 },
  { name: "Executive", w: 184.15, h: 266.7 },
];

const mm = (v: number) => v.toFixed(v % 1 === 0 ? 0 : 2);
const inch = (v: number) => (v / 25.4).toFixed(2);

export default function PaperSizes() {
  const [series, setSeries] = useState<Series>("A");
  const papers: Paper[] =
    series === "US"
      ? US
      : Object.entries(ISO[series]).map(([name, [w, h]]) => ({ name, w, h }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid max-w-xs gap-1.5">
        <label className="text-sm font-medium">Series</label>
        <Select
            value={series}
            onValueChange={(v) => v && setSeries(v as Series)}
          >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A">ISO A</SelectItem>
            <SelectItem value="B">ISO B</SelectItem>
            <SelectItem value="C">ISO C</SelectItem>
            <SelectItem value="US">US sizes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Size</th>
              <th className="px-4 py-2 font-medium">mm</th>
              <th className="px-4 py-2 font-medium">inches</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((paper) => (
              <tr key={paper.name} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Badge variant="secondary">{paper.name}</Badge>
                </td>
                <td className="px-4 py-2 font-mono tabular-nums">
                  {mm(paper.w)} × {mm(paper.h)}
                </td>
                <td className="px-4 py-2 font-mono tabular-nums">
                  {inch(paper.w)} × {inch(paper.h)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}