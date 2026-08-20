export type SqlLanguage = "vb" | "cs" | "auto";

export type SqlParam = { name: string; expr: string };
export type SqlVariant = { label: string; sql: string };
export type SqlConvertResult = {
  language: Exclude<SqlLanguage, "auto">;
  code: string;
  parameters: SqlParam[];
  variants: SqlVariant[];
};

type Helpers = { names: Set<string>; values: Map<string, string> };
type Item = { raw: string; start: number; end: number; literal: boolean };

const IDENTIFIER = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/;

export function parseHelpers(input: string): Helpers {
  const names = new Set<string>();
  const values = new Map<string, string>();
  const valuePattern = /(?:Property|Const|Dim)\s+(\w+)(?:\s+As\s+\w+)?\s*=\s*("(?:[^"]|"")*"|-?\d+(?:\.\d+)?)/gi;
  const csharpValuePattern = /(?:static\s+)?(?:readonly\s+)?(?:string|int|long|decimal|double)\s+(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?)/gi;

  for (const match of input.matchAll(valuePattern)) {
    const name = match[1];
    if (!name) continue;
    names.add(name);
    const value = match[2];
    values.set(name, value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value);
  }
  for (const match of input.matchAll(csharpValuePattern)) {
    const name = match[1];
    names.add(name);
    const value = match[2];
    values.set(name, value.startsWith('"') ? value.slice(1, -1).replace(/\\"/g, '"') : value);
  }

  for (const match of input.matchAll(/[A-Za-z_]\w*/g)) names.add(match[0]);
  return { names, values };
}

function detectLanguage(input: string): Exclude<SqlLanguage, "auto"> {
  if (/\bEnd\s+If\b|\bElseIf\b|&\s*(?:\$?"|[A-Za-z_])/.test(input)) return "vb";
  return "cs";
}

function isLiteral(raw: string, language: "vb" | "cs") {
  const value = raw.trim();
  return language === "cs"
    ? /^(?:\$|@\$|\$@)?"[\s\S]*"$/.test(value)
    : /^"[\s\S]*"$/.test(value);
}

function splitConcat(expression: string, operator: "&" | "+", language: "vb" | "cs"): Item[] {
  const items: Item[] = [];
  let start = 0;
  let quote = false;
  let braceDepth = 0;
  let i = 0;

  while (i < expression.length) {
    const char = expression[i];
    if (quote) {
      if (language === "vb" && char === '"' && expression[i + 1] === '"') {
        i += 2;
        continue;
      }
      if (language === "cs" && char === "\\") {
        i += 2;
        continue;
      }
      if (char === '"') quote = false;
    } else if (char === '"') {
      quote = true;
    } else if (language === "cs" && char === "{") {
      braceDepth++;
    } else if (language === "cs" && char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (char === operator && braceDepth === 0) {
      const raw = expression.slice(start, i);
      items.push({ raw, start, end: i, literal: isLiteral(raw, language) });
      start = i + 1;
    }
    i++;
  }

  const raw = expression.slice(start);
  items.push({ raw, start, end: expression.length, literal: isLiteral(raw, language) });
  return items;
}

function literalContent(raw: string) {
  const value = raw.trim();
  const opening = value.indexOf('"');
  const closing = value.lastIndexOf('"');
  return opening >= 0 && closing > opening ? value.slice(opening + 1, closing) : value;
}

function contentQuotePosition(item: Item, side: "start" | "end") {
  const trimmed = item.raw.trim();
  const trimOffset = item.raw.indexOf(trimmed);
  const opening = trimmed.indexOf('"');
  const closing = trimmed.lastIndexOf('"');
  return item.start + trimOffset + (side === "start" ? opening + 1 : closing - 1);
}

function parameterName(expr: string, used: Map<string, string>, params: SqlParam[]) {
  const existing = used.get(expr);
  if (existing) return existing;
  const last = expr.trim().match(/[A-Za-z_]\w*$/)?.[0] ?? "value";
  const base = last.replace(/^_+/, "") || "value";
  let name = `@${base}`;
  let suffix = 2;
  while (params.some((param) => param.name === name && param.expr !== expr)) name = `@${base}${suffix++}`;
  used.set(expr, name);
  params.push({ name, expr: expr.trim() });
  return name;
}

function helperValue(expr: string, helpers: Helpers) {
  const trimmed = expr.trim();
  const last = trimmed.split(".").pop() ?? trimmed;
  return helpers.values.get(trimmed) ?? helpers.values.get(last);
}

function isHelper(expr: string, helpers: Helpers) {
  const trimmed = expr.trim();
  const last = trimmed.split(".").pop() ?? trimmed;
  return helpers.names.has(trimmed) || helpers.names.has(last);
}

function transformInterpolated(raw: string, language: "vb" | "cs", helpers: Helpers, params: SqlParam[], used: Map<string, string>) {
  if (language !== "cs" || !/^\$["@]/.test(raw.trim())) return { code: raw, rendered: literalContent(raw), changed: false };
  const content = literalContent(raw);
  let changed = false;
  const rendered = content.replace(/'\s*\{\s*([^{}]+?)\s*\}\s*'/g, (_, expr: string) => {
    if (isHelper(expr, helpers)) return `'${helperValue(expr, helpers) ?? expr.trim()}'`;
    const name = parameterName(expr, used, params);
    changed = true;
    return name;
  });
  return { code: changed ? `"${rendered}"` : raw, rendered, changed };
}

function branchState(line: string, language: "vb" | "cs", stack: string[]) {
  const trimmed = line.trim();
  if (language === "vb") {
    const ifMatch = trimmed.match(/^If\s+(.+?)\s+Then\s*$/i);
    const elseIf = trimmed.match(/^ElseIf\s+(.+?)\s+Then\s*$/i);
    if (ifMatch) stack.push(ifMatch[1].trim());
    else if (elseIf && stack.length) stack[stack.length - 1] = elseIf[1].trim();
    else if (/^Else\s*$/i.test(trimmed) && stack.length) stack[stack.length - 1] = "Else";
    else if (/^End\s+If\s*$/i.test(trimmed)) stack.pop();
  } else {
    const ifMatch = trimmed.match(/^if\s*\((.+)\)/i);
    const elseIf = trimmed.match(/^}\s*else\s+if\s*\((.+)\)/i);
    if (elseIf && stack.length) stack[stack.length - 1] = elseIf[1].trim();
    else if (ifMatch) stack.push(ifMatch[1].trim());
    else if (/^}\s*else\b/i.test(trimmed) && stack.length) stack[stack.length - 1] = "else";
    else if (/^}/.test(trimmed)) stack.pop();
  }
}

export function convertSqlConcat(input: string, requested: SqlLanguage = "auto", helpersText = ""): SqlConvertResult | null {
  if (!input.trim()) return null;
  const language = requested === "auto" ? detectLanguage(input) : requested;
  const operator = language === "vb" ? "&" : "+";
  const helpers = parseHelpers(helpersText);
  const params: SqlParam[] = [];
  const used = new Map<string, string>();
  const stack: string[] = [];
  const records: { path: string[]; pieces: string[] }[] = [];
  const outputLines: string[] = [];
  let target: string | null = null;

  for (const originalLine of input.split("\n")) {
    branchState(originalLine, language, stack);
    const line = originalLine.replace(/\r$/, "");
    const pattern = language === "vb"
      ? /^(\s*)([A-Za-z_]\w*)\s*(?:&=\s*(.*)|=\s*\2\s*&\s*(.*))$/i
      : /^(\s*)([A-Za-z_]\w*)\s*(?:\+=\s*(.*)|=\s*\2\s*\+\s*(.*?);?\s*)$/;
    let match = line.match(pattern);
    if (!match && language === "cs") {
      const interpolation = line.match(/^(\s*)(?:var|[A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*=\s*(\$"[\s\S]*");?\s*$/);
      if (interpolation) match = [interpolation[0], interpolation[1], interpolation[2], interpolation[3], undefined] as RegExpMatchArray;
    }
    if (!match) {
      outputLines.push(line);
      continue;
    }
    const expression = match[3] ?? match[4] ?? "";
    const currentTarget = match[2];
    if (!target) target = currentTarget;
    if (currentTarget !== target) {
      outputLines.push(line);
      continue;
    }

    const items = splitConcat(expression, operator, language);
    if (!items.some((item) => item.literal)) {
      outputLines.push(line);
      continue;
    }
    const replacements: { start: number; end: number; text: string }[] = [];
    const parameterized = new Map<number, string>();
    for (let i = 1; i < items.length - 1; i++) {
      const item = items[i];
      if (item.literal) continue;
      const previous = items[i - 1];
      const next = items[i + 1];
      const previousContent = previous.literal ? literalContent(previous.raw) : "";
      const nextContent = next.literal ? literalContent(next.raw) : "";
      const expr = item.raw.trim();
      const quoted = previous.literal && next.literal && previousContent.endsWith("'") && nextContent.startsWith("'") && !previousContent.endsWith("''") && !nextContent.startsWith("''");
      if (!quoted || !IDENTIFIER.test(expr) || isHelper(expr, helpers)) continue;
      const name = parameterName(expr, used, params);
      parameterized.set(i, name);
      const offset = item.raw.indexOf(expr);
      replacements.push({ start: item.start + offset, end: item.end - (item.raw.length - offset - expr.length), text: name });
      const previousQuote = contentQuotePosition(previous, "end");
      const nextQuote = contentQuotePosition(next, "start");
      replacements.push({ start: previousQuote, end: previousQuote + 1, text: "" });
      replacements.push({ start: nextQuote, end: nextQuote + 1, text: "" });
    }
    const rendered: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.literal) {
        const transformed = transformInterpolated(item.raw.trim(), language, helpers, params, used);
        let value = transformed.rendered;
        if (parameterized.has(i - 1)) value = value.slice(1);
        if (parameterized.has(i + 1)) value = value.slice(0, -1);
        rendered.push(value);
        if (transformed.changed) {
          const offset = item.raw.indexOf(item.raw.trim());
          replacements.push({ start: item.start + offset, end: item.end - (item.raw.length - offset - item.raw.trim().length), text: transformed.code });
        }
        continue;
      }
      const expr = item.raw.trim();
      if (parameterized.has(i)) {
        rendered.push(parameterized.get(i)!);
      } else {
        rendered.push(helperValue(expr, helpers) ?? expr);
      }
    }
    const rebuiltExpression = [...replacements].sort((a, b) => b.start - a.start).reduce((value, replacement) => value.slice(0, replacement.start) + replacement.text + value.slice(replacement.end), expression);
    const expressionStart = line.indexOf(expression);
    outputLines.push(line.slice(0, expressionStart) + rebuiltExpression + line.slice(expressionStart + expression.length));
    records.push({ path: [...stack], pieces: rendered });
  }

  if (!records.length) return null;
  const paths = [[], ...records.map((record) => record.path)].filter((path, index, all) => all.findIndex((candidate) => candidate.join("\u0000") === path.join("\u0000")) === index);
  const variants = paths.map((path) => ({
    label: path.length ? path.join(" / ") : "Default path",
    sql: records.filter((record) => record.path.every((segment, index) => path[index] === segment)).flatMap((record) => record.pieces).join(""),
  })).filter((variant) => variant.sql.trim());

  return { language, code: outputLines.join("\n"), parameters: params, variants };
}
