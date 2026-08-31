type VbValue = string | number | boolean | null;

type Expr =
  | { kind: "str"; value: string }
  | { kind: "num"; value: number }
  | { kind: "id"; name: string }
  | { kind: "bool"; value: boolean }
  | { kind: "call"; name: string; args: Expr[] }
  | { kind: "dot"; obj: Expr; method: string; args: Expr[] }
  | { kind: "concat"; parts: Expr[] }
  | { kind: "arith"; op: string; left: Expr; right: Expr }
  | { kind: "cmp"; op: string; left: Expr; right: Expr }
  | { kind: "if"; cond: Expr; thenBranch: Expr; elseBranch: Expr }
  | { kind: "builtin"; name: string; args: Expr[] };

// ponytail: simple recursive-descent tokenizer + parser + evaluator for the
// subset of VB expressions found in helper function Return statements.
// Ceiling: string concat, If(), IsDate/IsNumeric, arithmetic, string methods,
// nested helper calls. Does NOT handle object access, loops, or side effects.

// ── Tokenizer ──────────────────────────────────────────────────────────────

type Token =
  | { kind: "str"; value: string }
  | { kind: "num"; value: number }
  | { kind: "id"; value: string }
  | { kind: "op"; value: string }
  | { kind: "lparen" | "rparen" | "comma" | "dot"; value: string };

const OPS = new Set(["&", "+", "-", "*", "/", "=", "<>", "<", ">", "<=", ">=", "AndAlso", "OrElse", "And", "Or", "Not", "Is"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1, value = "";
      while (j < input.length) {
        if (input[j] === '"' && input[j + 1] === '"') { value += '"'; j += 2; continue; }
        if (input[j] === '"') { j++; break; }
        value += input[j]; j++;
      }
      tokens.push({ kind: "str", value }); i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      tokens.push({ kind: "num", value: parseFloat(input.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j++;
      const word = input.slice(i, j);
      if (word === "True" || word === "False" || word === "Nothing") {
        tokens.push({ kind: "id", value: word });
      } else if (OPS.has(word)) {
        tokens.push({ kind: "op", value: word });
      } else {
        tokens.push({ kind: "id", value: word });
      }
      i = j; continue;
    }
    if (c === "(") { tokens.push({ kind: "lparen", value: "(" }); i++; continue; }
    if (c === ")") { tokens.push({ kind: "rparen", value: ")" }); i++; continue; }
    if (c === ",") { tokens.push({ kind: "comma", value: "," }); i++; continue; }
    if (c === ".") { tokens.push({ kind: "dot", value: "." }); i++; continue; }
    if (c === "=") { tokens.push({ kind: "op", value: "=" }); i++; continue; }
    if (c === "<" && input[i + 1] === ">") { tokens.push({ kind: "op", value: "<>" }); i += 2; continue; }
    if (c === "<" && input[i + 1] === "=") { tokens.push({ kind: "op", value: "<=" }); i += 2; continue; }
    if (c === ">" && input[i + 1] === "=") { tokens.push({ kind: "op", value: ">=" }); i += 2; continue; }
    if (c === "<") { tokens.push({ kind: "op", value: "<" }); i++; continue; }
    if (c === ">") { tokens.push({ kind: "op", value: ">" }); i++; continue; }
    if ("&+-*/".includes(c)) { tokens.push({ kind: "op", value: c }); i++; continue; }
    i++;
  }
  return tokens;
}

// ── Parser (recursive descent) ─────────────────────────────────────────────

function parse(source: string): Expr {
  const tokens = tokenize(source);
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }
  function consume(): Token {
    if (pos >= tokens.length) throw new Error("Unexpected end of expression");
    return tokens[pos++];
  }
  function consumeStr(): string {
    return String(consume().value);
  }

  function parseExpr(): Expr { return parseIf(); }

  function parseIf(): Expr {
    if (peek()?.kind === "id" && peek()!.value === "If") {
      consume();
      expect("lparen");
      const cond = parseExpr();
      expect("comma");
      const thenBranch = parseExpr();
      expect("comma");
      const elseBranch = parseExpr();
      expect("rparen");
      return { kind: "if", cond, thenBranch, elseBranch };
    }
    return parseOr();
  }

  function parseOr(): Expr {
    let left = parseAnd();
    while (peek()?.kind === "op" && (peek()!.value === "OrElse" || peek()!.value === "Or")) {
      const op = consumeStr();
      const right = parseAnd();
      left = { kind: "cmp", op, left, right };
    }
    return left;
  }

  function parseAnd(): Expr {
    let left = parseNot();
    while (peek()?.kind === "op" && (peek()!.value === "AndAlso" || peek()!.value === "And")) {
      const op = consumeStr();
      const right = parseNot();
      left = { kind: "cmp", op, left, right };
    }
    return left;
  }

  function parseNot(): Expr {
    if (peek()?.kind === "op" && peek()!.value === "Not") {
      consume();
      const inner = parseNot();
      return { kind: "cmp", op: "Not", left: inner, right: { kind: "bool", value: true } };
    }
    return parseComparison();
  }

  function parseComparison(): Expr {
    let left = parseConcat();
    while ((peek()?.kind === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(String(peek()!.value))) || (peek()?.kind === "op" && String(peek()!.value) === "Is")) {
      const op = consumeStr();
      const right = parseConcat();
      left = { kind: "cmp", op, left, right };
    }
    return left;
  }

  function parseConcat(): Expr {
    let left = parseAddSub();
    while (peek()?.kind === "op" && (peek()!.value === "&" || peek()!.value === "+")) {
      consumeStr();
      const right = parseAddSub();
      if (left.kind === "concat") {
        left.parts.push(right);
      } else {
        left = { kind: "concat", parts: [left, right] };
      }
    }
    return left;
  }

  function parseAddSub(): Expr {
    let left = parseMulDiv();
    while (peek()?.kind === "op" && (peek()!.value === "+" || peek()!.value === "-")) {
      const op = consumeStr();
      const right = parseMulDiv();
      left = { kind: "arith", op, left, right };
    }
    return left;
  }

  function parseMulDiv(): Expr {
    let left = parseUnary();
    while (peek()?.kind === "op" && (peek()!.value === "*" || peek()!.value === "/")) {
      const op = consumeStr();
      const right = parseUnary();
      left = { kind: "arith", op, left, right };
    }
    return left;
  }

  function parseUnary(): Expr {
    if (peek()?.kind === "op" && peek()!.value === "-") {
      consume();
      const inner = parseUnary();
      return { kind: "arith", op: "-", left: { kind: "num", value: 0 }, right: inner };
    }
    return parsePrimary();
  }

  function parsePrimary(): Expr {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end of expression");

    if (tok.kind === "str") { consume(); return { kind: "str", value: tok.value }; }
    if (tok.kind === "num") { consume(); return { kind: "num", value: tok.value }; }

    if (tok.kind === "id") {
      if (tok.value === "True") { consume(); return { kind: "bool", value: true }; }
      if (tok.value === "False") { consume(); return { kind: "bool", value: false }; }
      if (tok.value === "Nothing") { consume(); return { kind: "bool", value: false }; }

      // Built-in functions
      if (["IsDate", "IsNumeric", "IsNothing", "CInt", "CStr", "CDbl", "Trim", "Len", "Val"].includes(tok.value)) {
        consume();
        if (peek()?.kind === "lparen") {
          consume();
          const args: Expr[] = [];
          while (peek() && peek()!.kind !== "rparen") {
            if (peek()!.kind === "comma") consume();
            else args.push(parseExpr());
          }
          expect("rparen");
          return { kind: "builtin", name: tok.value, args };
        }
        return { kind: "builtin", name: tok.value, args: [] };
      }

      consume();
      let expr: Expr = { kind: "id", name: tok.value };
      expr = parsePostfix(expr, tok.value);
      return expr;
    }

    if (tok.kind === "lparen") {
      consume();
      const inner = parseExpr();
      expect("rparen");
      return parsePostfix(inner, "");
    }

    throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
  }

  // Handles `(...)` call and `.Method(...)` chains on a base expression.
  function parsePostfix(base: Expr, callName: string): Expr {
    let expr = base;
    // Check for call suffix on an identifier (e.g. DateValue, helper calls)
    if (callName && peek()?.kind === "lparen") {
      consume();
      const args: Expr[] = [];
      while (peek() && peek()!.kind !== "rparen") {
        if (peek()!.kind === "comma") consume();
        else args.push(parseExpr());
      }
      expect("rparen");
      expr = { kind: "call", name: callName, args };
    }
    // Check for .Method(...) chains
    while (peek()?.kind === "dot") {
      consume(); // skip dot
      const methodName = consumeStr(); // consume method name
      if (peek()?.kind === "lparen") {
        consume();
        const args: Expr[] = [];
        while (peek() && peek()!.kind !== "rparen") {
          if (peek()!.kind === "comma") consume();
          else args.push(parseExpr());
        }
        expect("rparen");
        expr = { kind: "dot", obj: expr, method: methodName, args };
      } else {
        expr = { kind: "dot", obj: expr, method: methodName, args: [] };
      }
    }
    return expr;
  }

  function expect(kind: string): Token {
    const tok = consume();
    if (!tok || tok.kind !== kind) throw new Error(`Expected ${kind}, got ${tok?.kind ?? "end"}`);
    return tok;
  }

  const result = parseExpr();
  return result;
}

// ── Evaluator ──────────────────────────────────────────────────────────────

type EvalCtx = {
  bindings: Record<string, VbValue>;
  resolveHelper: (name: string, args: string[]) => string | undefined;
  depth: number;
};

function toStr(v: VbValue): string { return v == null ? "" : String(v); }
function toNum(v: VbValue): number { const n = Number(v); return isNaN(n) ? 0 : n; }
function toBool(v: VbValue): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "" && v.toLowerCase() !== "false" && v !== "0";
  return false;
}

function isDateStr(s: string): boolean {
  if (!s || s.length < 3) return false;
  const trimmed = s.replace(/['"]/g, "").trim();
  const d = new Date(trimmed);
  return !isNaN(d.getTime()) && (trimmed.includes("/") || trimmed.includes("-") || trimmed.includes(" ") || /\d{4}/.test(trimmed));
}

function isNumericStr(s: string): boolean {
  const trimmed = s.replace(/['"]/g, "").trim();
  return trimmed !== "" && !isNaN(Number(trimmed));
}

const MAX_DEPTH = 8;

function evalExpr(node: Expr, ctx: EvalCtx): VbValue {
  if (ctx.depth > MAX_DEPTH) return "<max depth>";

  switch (node.kind) {
    case "str": return node.value;
    case "num": return node.value;
    case "bool": return node.value;

    case "id": {
      const name = node.name;
      if (name === "Nothing" || name === "null") return null;
      if (ctx.bindings[name] !== undefined) return ctx.bindings[name];
      return name;
    }

    case "concat": {
      return node.parts.map(p => toStr(evalExpr(p, ctx))).join("");
    }

    case "arith": {
      const left = evalExpr(node.left, ctx);
      const right = evalExpr(node.right, ctx);
      const ln = toNum(left), rn = toNum(right);
      switch (node.op) {
        case "+": return ln + rn;
        case "-": return ln - rn;
        case "*": return ln * rn;
        case "/": return rn === 0 ? 0 : ln / rn;
        default: return 0;
      }
    }

    case "cmp": {
      const left = evalExpr(node.left, ctx);
      if (node.op === "Not") return !toBool(left);
      const right = evalExpr(node.right, ctx);
      switch (node.op) {
        case "=": return toStr(left) === toStr(right);
        case "Is": return toBool(left) === toBool(right);
        case "<>": return toStr(left) !== toStr(right);
        case "<": return toNum(left) < toNum(right);
        case ">": return toNum(left) > toNum(right);
        case "<=": return toNum(left) <= toNum(right);
        case ">=": return toNum(left) >= toNum(right);
        case "And": case "AndAlso": return toBool(left) && toBool(right);
        case "Or": case "OrElse": return toBool(left) || toBool(right);
        default: return false;
      }
    }

    case "if": {
      const cond = evalExpr(node.cond, ctx);
      return toBool(cond) ? evalExpr(node.thenBranch, { ...ctx, depth: ctx.depth + 1 }) : evalExpr(node.elseBranch, { ...ctx, depth: ctx.depth + 1 });
    }

    case "call": {
      const args = node.args.map(a => toStr(evalExpr(a, ctx)));
      const resolved = ctx.resolveHelper(node.name, args);
      if (resolved !== undefined) return resolved;
      // Unresolved: return as VB source text
      return `${node.name}(${args.join(", ")})`;
    }

    case "dot": {
      const obj = evalExpr(node.obj, ctx);
      const objStr = toStr(obj);
      if (node.args.length === 0) {
        switch (node.method) {
          case "Length": return objStr.length;
          case "ToUpper": return objStr.toUpperCase();
          case "ToLower": return objStr.toLowerCase();
          case "Trim": return objStr.trim();
          case "ToString": return objStr;
          default: return objStr;
        }
      }
      const mArgs = node.args.map(a => toStr(evalExpr(a, ctx)));
      switch (node.method) {
        case "Replace": return objStr.split(mArgs[0] ?? "").join(mArgs[1] ?? "");
        case "PadRight": {
          const targetLen = toNum(mArgs[0]);
          const padChar = mArgs[1]?.[0] ?? " ";
          return objStr.length >= targetLen ? objStr : objStr + padChar.repeat(targetLen - objStr.length);
        }
        case "PadLeft": {
          const targetLen = toNum(mArgs[0]);
          const padChar = mArgs[1]?.[0] ?? " ";
          return objStr.length >= targetLen ? objStr : padChar.repeat(targetLen - objStr.length) + objStr;
        }
        case "Contains": return objStr.includes(mArgs[0] ?? "");
        case "StartsWith": return objStr.startsWith(mArgs[0] ?? "");
        case "EndsWith": return objStr.endsWith(mArgs[0] ?? "");
        case "Substring": return objStr.substring(toNum(mArgs[0]), mArgs[1] !== undefined ? toNum(mArgs[0]) + toNum(mArgs[1]) : undefined);
        case "Split": {
          const sep = mArgs[0] ?? ",";
          const parts = objStr.split(sep);
          const idx = mArgs[1] !== undefined ? toNum(mArgs[1]) : -1;
          return idx >= 0 && idx < parts.length ? parts[idx] : parts.join(sep);
        }
        case "ToUpper": return objStr.toUpperCase();
        case "ToLower": return objStr.toLowerCase();
        case "Trim": return objStr.trim();
        case "ToString": return objStr;
        default: return objStr;
      }
    }

    case "builtin": {
      const args = node.args.map(a => evalExpr(a, ctx));
      const arg0 = args[0];
      const s0 = arg0 !== undefined ? toStr(arg0) : "";
      switch (node.name) {
        case "IsDate": return isDateStr(s0);
        case "IsNumeric": return isNumericStr(s0);
        case "IsNothing": return arg0 === null || arg0 === undefined || s0.toLowerCase() === "nothing";
        case "Trim": return s0.trim();
        case "Len": return s0.length;
        case "Val": return toNum(s0);
        case "CInt": return Math.floor(toNum(arg0));
        case "CStr": return s0;
        case "CDbl": return toNum(arg0);
        default: return s0;
      }
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export type HelperRegistry = {
  resolve: (name: string) => { params: { name: string; default?: string }[]; bodySource: string } | undefined;
};

export function vbEval(source: string, bindings: Record<string, VbValue>, registry: HelperRegistry): string {
  try {
    const ast = parse(source);
    const ctx: EvalCtx = {
      bindings,
      resolveHelper: (name, args) => {
        const helper = registry.resolve(name);
        if (!helper) return undefined;
        const innerBindings: Record<string, VbValue> = { ...bindings };
        helper.params.forEach((param, i) => {
          if (i < args.length && args[i] !== "") {
            innerBindings[param.name] = args[i];
          } else if (param.default !== undefined) {
            innerBindings[param.name] = param.default;
          }
        });
        return vbEval(helper.bodySource, innerBindings, registry);
      },
      depth: 0,
    };
    const result = evalExpr(ast, ctx);
    return toStr(result);
  } catch {
    return source;
  }
}
