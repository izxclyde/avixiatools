"use client";

import { FormatterPanel } from "@/components/tools/shared";
import { formatJson, minifyJson } from "@/lib/logic/format";

export default function JsonFormatter() {
  return (
    <FormatterPanel
      format={formatJson}
      minify={minifyJson}
      placeholder={'{"name": "avixiatools", "tools": 17}'}
    />
  );
}