export type SqlToCodeLanguage = "vb" | "cs";

export type SqlToCodeOptions = {
  language: SqlToCodeLanguage;
  variable?: string;
  prefix?: string;
  quoteValues?: boolean;
  lineLength?: number;
};

export type SqlToCodeParam = { name: string; expr: string };
export type SqlToCodeResult = {
  language: SqlToCodeLanguage;
  code: string;
  parameters: SqlToCodeParam[];
};

type Token =
  | { kind: "text"; value: string }
  | { kind: "literal"; value: string }
  | { kind: "comment"; value: string }
  | { kind: "param"; name: string }
  | { kind: "break" };

type Chunk = { value: string; start: boolean; lead?: string };
type Piece = { type: "lit"; text: string } | { type: "param"; name: string };

// Clause keywords that deserve their own concatenation line.
const BREAK =
  /(?<![\w])(LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|GROUP\s+BY|ORDER\s+BY|UNION\s+ALL|WHERE|JOIN|AND|OR|ON|HAVING|UNION|LIMIT|OFFSET|SET|VALUES|WHEN|ELSE|END)(?![\w])/gi;

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let text = "";
  const flush = () => {
    if (text) {
      tokens.push({ kind: "text", value: text });
      text = "";
    }
  };

  let i = 0;
  while (i < query.length) {
    const c = query[i];
    if (c === "'") {
      flush();
      let j = i + 1;
      let value = "'";
      while (j < query.length) {
        if (query[j] === "'") {
          if (query[j + 1] === "'") {
            value += "''";
            j += 2;
            continue;
          }
          value += "'";
          j++;
          break;
        }
        value += query[j];
        j++;
      }
      tokens.push({ kind: "literal", value });
      i = j;
    } else if (query.startsWith("--", i)) {
      flush();
      const nl = query.indexOf("\n", i);
      const end = nl === -1 ? query.length : nl;
      tokens.push({ kind: "comment", value: query.slice(i, end) });
      i = end;
    } else if (query.startsWith("/*", i)) {
      flush();
      const end = query.indexOf("*/", i + 2);
      const close = end === -1 ? query.length : end + 2;
      tokens.push({ kind: "comment", value: query.slice(i, close) });
      i = close;
    } else if (c === "@" && query[i + 1] !== "@" && /[A-Za-z_]/.test(query[i + 1] ?? "")) {
      flush();
      let j = i + 1;
      while (j < query.length && /[A-Za-z0-9_]/.test(query[j])) j++;
      tokens.push({ kind: "param", name: query.slice(i + 1, j) });
      i = j;
    } else {
      text += c;
      i++;
    }
  }
  flush();
  return tokens;
}

// Collapse whitespace runs to a single space; a newline becomes a trailing
// space plus a line break, so generated lines still join into one query.
function normalize(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const tok of tokens) {
    if (tok.kind !== "text") {
      out.push(tok);
      continue;
    }
    const parts = tok.value.split("\n");
    parts.forEach((raw, index) => {
      const collapsed = raw.replace(/[ \t\r]+/g, " ");
      if (collapsed) out.push({ kind: "text", value: index < parts.length - 1 ? collapsed + " " : collapsed });
      if (index < parts.length - 1) out.push({ kind: "break" });
    });
  }
  return out;
}

// Cut a line at clause keywords so each clause gets its own `var += ...`.
// A whitespace-only prefix before a keyword merges in as the new line's lead.
function splitKeywords(text: string): Chunk[] {
  const out: Chunk[] = [];
  let rest = text;
  while (rest.length) {
    const match = BREAK.exec(rest);
    BREAK.lastIndex = 0;
    if (!match) {
      if (rest) out.push({ value: rest, start: false });
      break;
    }
    const pre = rest.slice(0, match.index);
    if (pre) {
      if (/^\s+$/.test(pre)) out.push({ value: match[0], start: true, lead: pre });
      else {
        out.push({ value: pre, start: false });
        out.push({ value: match[0], start: true });
      }
    } else {
      out.push({ value: match[0], start: true });
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

function escapeText(text: string, language: SqlToCodeLanguage) {
  return language === "vb" ? text.replace(/"/g, '""') : text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function renderLine(variable: string, pieces: Piece[], language: SqlToCodeLanguage, expr: (name: string) => string) {
  const op = language === "vb" ? "&" : "+";
  let body = "";
  for (const piece of pieces) {
    if (piece.type === "lit") body += escapeText(piece.text, language);
    else body += `" ${op} ${expr(piece.name)} ${op} "`;
  }
  const line = language === "vb" ? `${variable} ${op}= "${body}"` : `${variable} ${op}= "${body}";`;
  if (language === "vb") return line.replace(/\s*&\s*""$/, "");
  return line.replace(/\s*\+\s*""(?=;$)/, "");
}

// Wrap string values in SQL single quotes around each parameter.
function applyQuotes(lines: Piece[][]) {
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (line[i].type !== "param") continue;
      const prev = line[i - 1];
      if (prev && prev.type === "lit") {
        prev.text += "'";
      } else {
        line.splice(i, 0, { type: "lit", text: "'" });
        i++;
      }
      const next = line[i + 1];
      if (next && next.type === "lit") {
        next.text = "'" + next.text;
      } else {
        line.splice(i + 1, 0, { type: "lit", text: "'" });
      }
    }
  }
}

export function sqlToCode(query: string, options: SqlToCodeOptions): SqlToCodeResult | null {
  if (!query.trim()) return null;
  const { language } = options;
  const variable = options.variable?.trim() || "q";
  const prefix = options.prefix ?? (language === "vb" ? "_" : "");
  const quoteValues = options.quoteValues !== false;
  const lineLength = options.lineLength ?? 80;

  const tokens = normalize(tokenize(query.trim()));
  const lines: Piece[][] = [];
  let cur: Piece[] = [];
  let curLen = 0;

  // A clause break (keyword or newline) must not lose the space that separated
  // the fragments, so pad the end of the previous line where needed.
  const padLineEnd = () => {
    if (!cur.length) return;
    const last = cur[cur.length - 1];
    if (last.type === "lit") {
      if (!/\s$/.test(last.text)) last.text += " ";
    } else {
      cur.push({ type: "lit", text: " " });
    }
  };

  const flushLine = () => {
    if (!cur.length) return;
    lines.push(cur);
    cur = [];
    curLen = 0;
  };

  const pushText = (text: string, start: boolean) => {
    if (start && cur.length) {
      padLineEnd();
      flushLine();
    }
    let remaining = text;
    while (remaining.length) {
      if (!cur.length) {
        remaining = remaining.replace(/^\s+/, "");
        if (!remaining) break;
      }
      const budget = lineLength - curLen;
      if (cur.length === 0 || budget >= remaining.length) {
        cur.push({ type: "lit", text: remaining });
        curLen += remaining.length;
        break;
      }
      const space = remaining.lastIndexOf(" ", budget);
      if (space <= 0) {
        cur.push({ type: "lit", text: remaining.slice(0, budget) });
        curLen += budget;
        remaining = remaining.slice(budget);
      } else {
        cur.push({ type: "lit", text: remaining.slice(0, space + 1) });
        curLen += space + 1;
        remaining = remaining.slice(space + 1);
      }
      flushLine();
    }
  };

  const pushParam = (name: string) => {
    if (!cur.length) cur.push({ type: "lit", text: "" });
    cur.push({ type: "param", name });
    curLen += 1;
  };

  for (const tok of tokens) {
    if (tok.kind === "break") {
      padLineEnd();
      flushLine();
    } else if (tok.kind === "comment") {
      flushLine();
      lines.push([{ type: "lit", text: tok.value }]);
      cur = [];
      curLen = 0;
    } else if (tok.kind === "param") {
      pushParam(tok.name);
    } else if (tok.kind === "literal") {
      pushText(tok.value, false);
    } else {
      for (const chunk of splitKeywords(tok.value)) {
        pushText((chunk.lead ?? "") + chunk.value, chunk.start);
      }
    }
  }
  flushLine();

  if (quoteValues) applyQuotes(lines);

  const exprOf = (name: string) => prefix + name;
  const init = [`${variable} = ""${language === "cs" ? ";" : ""}`];
  const code = [...init, ...lines.map((line) => renderLine(variable, line, language, exprOf))].join("\n");

  const parameters: SqlToCodeParam[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    for (const piece of line) {
      if (piece.type === "param" && !seen.has(piece.name)) {
        seen.add(piece.name);
        parameters.push({ name: "@" + piece.name, expr: exprOf(piece.name) });
      }
    }
  }

  return { language, code, parameters };
}
