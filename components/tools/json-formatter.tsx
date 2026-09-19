"use client";

import { FormatterPanel } from "@/components/tools/shared";
import { formatJson, minifyJson, parseJsonTree } from "@/lib/logic/format";
import { JsonTreeView } from "@/components/tools/json-tree-view";

function describeJson(input: string): string | null {
  try {
    const value: unknown = JSON.parse(input);
    if (Array.isArray(value))
      return `${value.length} item${value.length === 1 ? "" : "s"} · array.`;
    if (value !== null && typeof value === "object") {
      const keys = Object.keys(value).length;
      return `${keys} key${keys === 1 ? "" : "s"} · object.`;
    }
    return "Valid primitive value.";
  } catch {
    return null;
  }
}

export default function JsonFormatter() {
  return (
    <FormatterPanel
      format={formatJson}
      minify={minifyJson}
      describe={describeJson}
      placeholder={'{"name": "avixiatools", "tools": 17}'}
      example={'{"name": "avixiatools", "tools": 17, "free": true}'}
      storageKey="avixia:json:input"
      renderOutput={(output) => {
        const tree = parseJsonTree(output);
        if (!tree) return null;
        return <JsonTreeView tree={tree} rawJson={output} />;
      }}
    />
  );
}