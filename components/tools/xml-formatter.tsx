"use client";

import { FormatterPanel } from "@/components/tools/shared";
import { formatXml, minifyXml } from "@/lib/logic/format";

export default function XmlFormatter() {
  return (
    <FormatterPanel
      format={formatXml}
      minify={minifyXml}
      placeholder={'<?xml version="1.0"?>\n<root><item id="1">value</item></root>'}
    />
  );
}