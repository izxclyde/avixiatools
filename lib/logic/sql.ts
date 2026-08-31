import { vbEval, type HelperRegistry } from "./vb-eval.ts";

export type SqlLanguage = "vb" | "cs" | "auto";

export type SqlParam = { name: string; expr: string };
export type SqlVariant = { label: string; sql: string };
export type SqlConvertResult = {
  language: Exclude<SqlLanguage, "auto">;
  code: string;
  parameters: SqlParam[];
  variants: SqlVariant[];
};

type FuncParam = { name: string; default?: string };
type FunctionHelper = { name: string; params: FuncParam[]; bodySource: string };
type Helpers = { names: Set<string>; values: Map<string, string>; functions: Map<string, FunctionHelper> };
type Item = { raw: string; start: number; end: number; literal: boolean };

const IDENTIFIER = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/;

export function parseHelpers(input: string): Helpers {
  const names = new Set<string>();
  const values = new Map<string, string>();
  const functions = new Map<string, FunctionHelper>();
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

  // Parse VB function helpers: Public [Shared] Function Name(params) As Type ... Return expr ... End Function
  const funcPattern = /(?:Public|Friend|Private)\s+(?:Shared\s+)?(?:ReadOnly\s+)?Function\s+(\w+)\s*\(([^)]*)\)\s+As\s+\w+[\s\S]*?Return\s+([\s\S]*?)End\s+Function/gi;
  for (const match of input.matchAll(funcPattern)) {
    const name = match[1];
    const rawParams = match[2].trim();
    const bodySource = match[3].trim();
    if (!name || !bodySource) continue;
    const params: FuncParam[] = [];
    if (rawParams) {
      for (const p of rawParams.split(",")) {
        const trimmed = p.trim();
        const optionalMatch = trimmed.match(/^Optional\s+(\w+)(?:\s+As\s+\w+)?\s*=\s*(.*)$/i);
        if (optionalMatch) {
          const def = optionalMatch[2].trim();
          params.push({ name: optionalMatch[1], default: def.startsWith('"') ? def.slice(1, -1).replace(/""/g, '"') : def });
        } else {
          const nameMatch = trimmed.match(/^(\w+)/);
          if (nameMatch) params.push({ name: nameMatch[1] });
        }
      }
    }
    names.add(name);
    functions.set(name, { name, params, bodySource });
  }

  // ponytail: only add bare identifiers that are actually registered helpers
  // (constants or functions). The old catch-all scan polluted `names` with
  // every token in the helpers text (keywords, class names, etc.).
  for (const match of input.matchAll(/(?:Property|Const|Dim|Function)\s+(\w+)/gi)) {
    names.add(match[1]);
  }
  return { names, values, functions };
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

// ponytail: split on both & and + so mixed legacy code (VB-style & with
// C#-style +=) keeps working; neither operator is ambiguous in practice here.
function splitConcat(expression: string, language: "vb" | "cs"): Item[] {
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
    } else if ((char === "&" || char === "+") && braceDepth === 0) {
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

function helperValue(expr: string, helpers: Helpers, paramBindings: Record<string, string> = {}) {
  const trimmed = expr.trim();
  const last = trimmed.split(".").pop() ?? trimmed;

  // Check constant helpers first
  const constant = helpers.values.get(trimmed) ?? helpers.values.get(last);
  if (constant !== undefined) return constant;

  // Check function helpers: match [Prefix.]FuncName(args) or [Prefix.]FuncName
  const callMatch = trimmed.match(/^(?:\w+\.)?(\w+)\s*\(([^)]*)\)\s*$/) ?? trimmed.match(/^(?:\w+\.)?(\w+)\s*$/);
  if (callMatch) {
    const funcName = callMatch[1];
    const helper = helpers.functions.get(funcName);
    if (!helper) return undefined;
    // Parse call args
    const rawArgs = callMatch[2] ?? "";
    const callArgs: string[] = rawArgs.trim() ? rawArgs.split(",").map(a => a.trim()) : [];
    // Build bindings: call args mapped to declared param names, with defaults
    const bindings: Record<string, string> = { ...paramBindings };
    helper.params.forEach((param, i) => {
      if (i < callArgs.length && callArgs[i] !== "") {
        // Try to resolve the call arg against known param bindings
        bindings[param.name] = paramBindings[callArgs[i]] ?? callArgs[i];
      } else if (param.default !== undefined) {
        bindings[param.name] = param.default;
      }
    });
    // Evaluate via vbEval
    const registry: HelperRegistry = {
      resolve: (name) => {
        const h = helpers.functions.get(name);
        return h ? { params: h.params, bodySource: h.bodySource } : undefined;
      },
    };
    return vbEval(helper.bodySource, bindings, registry);
  }

  return undefined;
}

function isHelper(expr: string, helpers: Helpers) {
  const trimmed = expr.trim();
  const last = trimmed.split(".").pop() ?? trimmed;
  if (helpers.names.has(trimmed) || helpers.names.has(last)) return true;
  // Also detect function calls: [Prefix.]FuncName(args...)
  const callMatch = trimmed.match(/^(?:\w+\.)?(\w+)\s*\(/);
  return callMatch ? helpers.functions.has(callMatch[1]) : false;
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

type AssignmentMatch = { target: string; expression: string; compound: boolean };

// Any `X = ...`, `X += ...` or `X &= ...` assignment is a candidate; the RHS is
// later validated to actually be a string-building concatenation.
function matchAssignment(line: string, language: "vb" | "cs"): AssignmentMatch | null {
  const pattern = /^(\s*)([A-Za-z_]\w*)\s*(?:(?:\+=|&=)\s*(.*)|=\s*(.*?);?\s*)$/;
  const match = line.match(pattern);
  if (match) return { target: match[2], compound: !!match[3], expression: (match[3] ?? match[4] ?? "").replace(/;?\s*$/, "").trim() };
  if (language === "cs") {
    const interpolation = line.match(/^(\s*)(?:var|[A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*=\s*(\$"[\s\S]*");?\s*$/);
    if (interpolation) return { target: interpolation[2], compound: false, expression: (interpolation[3] ?? "").replace(/;?\s*$/, "") };
  }
  return null;
}

function isChain(match: AssignmentMatch, items: Item[], language: "vb" | "cs") {
  if (!items.some((item) => item.literal)) return false;
  if (items.length > 1) return true;
  if (match.compound) return true;
  return language === "cs" && /^\s*\$["@]/.test(match.expression);
}

function isInterpolated(expression: string) {
  return /^\s*\$["@]/.test(expression);
}

export function convertSqlConcat(input: string, requested: SqlLanguage = "auto", helpersText = ""): SqlConvertResult | null {
  if (!input.trim()) return null;
  const language = requested === "auto" ? detectLanguage(input) : requested;
  const helpers = parseHelpers(helpersText);
  const params: SqlParam[] = [];
  const used = new Map<string, string>();
  const records: { target: string; path: string[]; pieces: string[] }[] = [];
  const outputLines: string[] = [];
  const lines = input.split("\n").map((line) => line.replace(/\r$/, ""));

  // Pass 1: find variables that hold concatenated SQL so plain-literal openers
  // to those variables (e.g. `Q = "SELECT * FROM T"`) still count as fragments.
  const targets = new Set<string>();
  for (const line of lines) {
    const match = matchAssignment(line, language);
    if (match && isChain(match, splitConcat(match.expression, language), language)) targets.add(match.target);
  }

  const stack: string[] = [];
  for (const line of lines) {
    branchState(line, language, stack);
    const match = matchAssignment(line, language);
    if (!match) {
      outputLines.push(line);
      continue;
    }
    const items = splitConcat(match.expression, language);
    const plainOpener = !match.compound && !isInterpolated(match.expression) && items.length === 1 && items[0].literal && targets.has(match.target);
    if (!isChain(match, items, language) && !plainOpener) {
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
      if (i === 0 && expr === match.target) continue;
      if (parameterized.has(i)) {
        rendered.push(parameterized.get(i)!);
      } else {
        // Build param bindings for function helper resolution
        const paramBindings: Record<string, string> = {};
        for (const p of params) paramBindings[p.expr] = p.name;
        rendered.push(helperValue(expr, helpers, paramBindings) ?? expr);
      }
    }
    const rebuiltExpression = [...replacements].sort((a, b) => b.start - a.start).reduce((value, replacement) => value.slice(0, replacement.start) + replacement.text + value.slice(replacement.end), match.expression);
    const expressionStart = line.indexOf(match.expression);
    outputLines.push(line.slice(0, expressionStart) + rebuiltExpression + line.slice(expressionStart + match.expression.length));
    records.push({ target: match.target, path: [...stack], pieces: rendered });
  }

  if (!records.length) return null;
  const targetsList = [...new Set(records.map((record) => record.target))];
  const multiple = targetsList.length > 1;
  const variants: SqlVariant[] = [];
  for (const target of targetsList) {
    const targetRecords = records.filter((record) => record.target === target);
    const paths = [[], ...targetRecords.map((record) => record.path)].filter((path, index, all) => all.findIndex((candidate) => candidate.join("\u0000") === path.join("\u0000")) === index);
    for (const path of paths) {
      const label = (multiple ? `${target} — ` : "") + (path.length ? path.join(" / ") : "Default path");
      const sql = targetRecords.filter((record) => record.path.length <= path.length && record.path.every((segment, index) => path[index] === segment)).flatMap((record) => record.pieces).join("");
      if (sql.trim()) variants.push({ label, sql });
    }
  }

  return { language, code: outputLines.join("\n"), parameters: params, variants };
}
