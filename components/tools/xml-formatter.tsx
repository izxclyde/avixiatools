"use client";

import { FormatterPanel } from "@/components/tools/shared";
import { formatXml, minifyXml, parseXml, type XmlNode } from "@/lib/logic/format";
import { XmlTreeView } from "@/components/tools/xml-tree-view";

function describeXml(input: string): string | null {
  const nodes = parseXml(input);
  if (!nodes) return null;
  let elements = 0;
  const walk = (list: XmlNode[]) => {
    for (const node of list) {
      if (node.kind === "element") {
        elements += 1;
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return `${elements} element${elements === 1 ? "" : "s"} · xml.`;
}

export default function XmlFormatter() {
  return (
    <FormatterPanel
      format={formatXml}
      minify={minifyXml}
      describe={describeXml}
      placeholder={'<?xml version="1.0"?>\n<root><item id="1">value</item></root>'}
      example={'<?xml version="1.0"?>\n<root><item id="1">value</item><item id="2">value</item></root>'}
      storageKey="avixia:xml:input"
      renderOutput={(output) => {
        const nodes = parseXml(output);
        if (!nodes) return null;
        return <XmlTreeView nodes={nodes} rawXml={output} />;
      }}
    />
  );
}