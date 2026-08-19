export function formatJson(input: string): string | null {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return null;
  }
}

export function minifyJson(input: string): string | null {
  try {
    return JSON.stringify(JSON.parse(input));
  } catch {
    return null;
  }
}

// ponytail: hand-rolled tokenizer so logic runs in plain Node for tests;
// DOMParser exists only in the browser and re-serialising reorders attributes.

type XmlPart =
  | { kind: "text"; value: string }
  | { kind: "open"; name: string; value: string }
  | { kind: "close"; name: string; value: string }
  | { kind: "selfClose"; name: string; value: string }
  | { kind: "comment"; value: string }
  | { kind: "cdata"; value: string }
  | { kind: "pi"; value: string };

const XML_NAME = /^[A-Za-z_:][A-Za-z0-9_:.-]*$/;

function tagEnd(input: string, from: number): number {
  let quote: string | null = null;
  for (let i = from + 1; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return i + 1;
    }
  }
  return -1;
}

function tokenizeXml(input: string): XmlPart[] | null {
  const parts: XmlPart[] = [];
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      parts.push({ kind: "text", value: input.slice(i) });
      break;
    }
    if (lt > i) parts.push({ kind: "text", value: input.slice(i, lt) });

    const name = (raw: string, close: boolean, selfClose: boolean): string => {
      const inner = close
        ? raw.slice(2, raw.length - 1)
        : raw.slice(1, selfClose ? raw.length - 2 : raw.length - 1);
      return inner.trim().split(/\s+/)[0];
    };

    if (input.startsWith("<!--", lt)) {
      const end = input.indexOf("-->", lt + 4);
      if (end === -1) return null;
      parts.push({ kind: "comment", value: input.slice(lt, end + 3) });
      i = end + 3;
    } else if (input.startsWith("<![CDATA[", lt)) {
      const end = input.indexOf("]]>", lt + 9);
      if (end === -1) return null;
      parts.push({ kind: "cdata", value: input.slice(lt, end + 3) });
      i = end + 3;
    } else {
      const end = tagEnd(input, lt);
      if (end === -1) return null;
      const raw = input.slice(lt, end);
      if (raw.startsWith("<?")) {
        parts.push({ kind: "pi", value: raw });
      } else if (raw.startsWith("</")) {
        const tagName = name(raw, true, false);
        if (!XML_NAME.test(tagName)) return null;
        parts.push({ kind: "close", name: tagName, value: raw });
      } else if (raw.endsWith("/>")) {
        const tagName = name(raw, false, true);
        if (!XML_NAME.test(tagName)) return null;
        parts.push({ kind: "selfClose", name: tagName, value: raw });
      } else {
        const tagName = name(raw, false, false);
        if (!XML_NAME.test(tagName)) return null;
        parts.push({ kind: "open", name: tagName, value: raw });
      }
      i = end;
    }
  }
  return parts;
}

type XmlNode =
  | { kind: "text" | "comment" | "cdata" | "pi"; raw: string }
  | {
      kind: "element";
      raw: string;
      name: string;
      open: string;
      close: string;
      selfClose: boolean;
      children: XmlNode[];
    };

// ponytail: tree parser so subtrees can be emitted verbatim (mixed content);
// a flat walk can't know where an element's original spacing ends.

function parseElement(tokens: XmlPart[], index: number): { node: XmlNode; next: number } | null {
  const openTok = tokens[index];
  if (openTok.kind !== "open") return null;
  const children: XmlNode[] = [];
  let i = index + 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === "close") {
      if (t.name !== openTok.name) return null;
      return {
        node: {
          kind: "element",
          raw: openTok.value + children.map((c) => c.raw).join("") + t.value,
          name: openTok.name,
          open: openTok.value,
          close: t.value,
          selfClose: false,
          children,
        },
        next: i + 1,
      };
    }
    if (t.kind === "open") {
      const r = parseElement(tokens, i);
      if (!r) return null;
      children.push(r.node);
      i = r.next;
      continue;
    }
    if (t.kind === "selfClose") {
      children.push({
        kind: "element",
        raw: t.value,
        name: t.name,
        open: t.value,
        close: "",
        selfClose: true,
        children: [],
      });
      i++;
      continue;
    }
    children.push({ kind: t.kind, raw: t.value });
    i++;
  }
  return null;
}

function parseXmlTree(tokens: XmlPart[]): XmlNode[] | null {
  const nodes: XmlNode[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === "open") {
      const r = parseElement(tokens, i);
      if (!r) return null;
      nodes.push(r.node);
      i = r.next;
    } else if (t.kind === "close") {
      return null;
    } else if (t.kind === "selfClose") {
      nodes.push({
        kind: "element",
        raw: t.value,
        name: t.name,
        open: t.value,
        close: "",
        selfClose: true,
        children: [],
      });
      i++;
    } else {
      nodes.push({ kind: t.kind, raw: t.value });
      i++;
    }
  }
  return nodes;
}

function hasText(children: XmlNode[]): boolean {
  return children.some((c) => c.kind === "text" && c.raw.trim() !== "");
}

function hasElement(children: XmlNode[]): boolean {
  return children.some((c) => c.kind === "element");
}

function formatNode(node: XmlNode, depth: number, out: string[]): void {
  const pad = "  ".repeat(depth);
  if (node.kind !== "element") {
    if (node.kind === "text") {
      if (node.raw.trim()) out.push(pad + node.raw.trim());
    } else {
      out.push(pad + node.raw);
    }
    return;
  }
  if (node.selfClose) {
    out.push(pad + node.raw);
    return;
  }
  const text = hasText(node.children);
  const elements = hasElement(node.children);
  if (text && elements) {
    out.push(pad + node.raw);
    return;
  }
  if (text) {
    const inner = node.children.map((c) => c.raw).join("");
    out.push(pad + node.open + (inner.includes("\n") ? inner.trim() : inner) + node.close);
    return;
  }
  out.push(pad + node.open);
  for (const child of node.children) formatNode(child, depth + 1, out);
  out.push(pad + node.close);
}

// Smart text preservation: element-only subtrees are re-indented, text-only
// elements collapse onto one line, and mixed content (text + elements) is
// emitted verbatim so whitespace data is never corrupted.
export function formatXml(input: string): string | null {
  const tokens = tokenizeXml(input);
  if (!tokens) return null;
  const nodes = parseXmlTree(tokens);
  if (!nodes) return null;
  const out: string[] = [];
  for (const node of nodes) formatNode(node, 0, out);
  return out.join("\n");
}

// ponytail: whitespace-only text nodes are dropped, like xmllint --noblanks;
// significant whitespace inside element content survives but minify is
// inherently lossy for XML.
export function minifyXml(input: string): string | null {
  const parts = tokenizeXml(input);
  if (!parts) return null;
  const stack: string[] = [];
  let out = "";
  for (const part of parts) {
    if (part.kind === "open") {
      stack.push(part.name);
      out += part.value;
    } else if (part.kind === "close") {
      if (stack.length === 0 || stack[stack.length - 1] !== part.name) return null;
      stack.pop();
      out += part.value;
    } else if (part.kind === "selfClose") {
      out += part.value;
    } else if (part.kind !== "text" || part.value.trim()) {
      out += part.value;
    }
  }
  if (stack.length > 0) return null;
  return out;
}