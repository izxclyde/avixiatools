"use client";

import { FormatterPanel } from "@/components/tools/shared";
import { formatJson, minifyJson, parseJsonTree } from "@/lib/logic/format";
import { JsonTreeView } from "@/components/tools/json-tree-view";

export default function JsonFormatter() {
  return (
    <FormatterPanel
      format={formatJson}
      minify={minifyJson}
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