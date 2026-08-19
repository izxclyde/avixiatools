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

// ponytail: text tokens are re-indented on their own line; mixed inline
// content like <p>Hello <b>world</b></p> loses its original spacing.
export function formatXml(input: string): string | null {
  const parts = tokenizeXml(input);
  if (!parts) return null;
  const stack: string[] = [];
  const out: string[] = [];
  for (const part of parts) {
    switch (part.kind) {
      case "text":
        if (part.value.trim()) out.push("  ".repeat(stack.length) + part.value.trim());
        break;
      case "comment":
      case "cdata":
      case "pi":
        out.push("  ".repeat(stack.length) + part.value);
        break;
      case "open":
        out.push("  ".repeat(stack.length) + part.value);
        stack.push(part.name);
        break;
      case "selfClose":
        out.push("  ".repeat(stack.length) + part.value);
        break;
      case "close":
        if (stack.length === 0 || stack[stack.length - 1] !== part.name) return null;
        stack.pop();
        out.push("  ".repeat(stack.length) + part.value);
        break;
    }
  }
  if (stack.length > 0) return null;
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