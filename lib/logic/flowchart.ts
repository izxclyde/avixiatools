// Pure flowchart helpers — no DOM or React imports, so they run in node --test.
// The canvas (React Flow) and the SVG/PNG export share these so both render identically.

export type FlowNodeKind = "terminator" | "process" | "decision" | "io" | "connector";

export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  x: number;
  y: number;
  label: string;
  fill?: string;
  stroke?: string;
  /** Custom size in canvas px. Absent = the kind default below. */
  w?: number;
  h?: number;
};

/** Which edge of a shape a connector leaves from / arrives at. */
export type FlowSide = "top" | "right" | "bottom" | "left";

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** Handle ids ("t"/"r"/"b"/"l"). Absent = first handle (bottom → top). */
  sourceHandle?: string;
  targetHandle?: string;
};

export type FlowDoc = {
  version: 1;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export const NODE_KINDS: FlowNodeKind[] = ["terminator", "process", "decision", "io", "connector"];

export const KIND_LABELS: Record<FlowNodeKind, string> = {
  terminator: "Start / end",
  process: "Process",
  decision: "Decision",
  io: "Input / output",
  connector: "Connector",
};

// Kind defaults — used when a node carries no custom size.
export const NODE_DEFAULTS: Record<FlowNodeKind, { w: number; h: number }> = {
  terminator: { w: 160, h: 60 },
  process: { w: 170, h: 84 },
  decision: { w: 170, h: 120 },
  io: { w: 180, h: 84 },
  connector: { w: 64, h: 64 },
};

// Smallest usable box per kind; resizing below this breaks the shape or its label.
export const NODE_MIN: Record<FlowNodeKind, { w: number; h: number }> = {
  terminator: { w: 60, h: 32 },
  process: { w: 60, h: 36 },
  decision: { w: 80, h: 60 },
  io: { w: 60, h: 36 },
  connector: { w: 24, h: 24 },
};

// ponytail: generous ceiling that only stops tab-crashing exports, not legit diagrams.
export const MAX_NODE_SIZE = 800;

export const FLOW_SIDES: FlowSide[] = ["top", "right", "bottom", "left"];

export const SIDE_LABELS: Record<FlowSide, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

// Handle ids are the side initials so a doc stays readable by hand.
export const HANDLE_IDS: Record<FlowSide, string> = {
  top: "t",
  right: "r",
  bottom: "b",
  left: "l",
};

export const handleFromSide = (side: FlowSide): string => HANDLE_IDS[side];

/** Defaults mirror the v1 look: leave the bottom, arrive at the top. */
export function sideFromHandle(
  handleId: string | undefined | null,
  fallback: FlowSide = "bottom"
): FlowSide {
  const match = FLOW_SIDES.find((s) => HANDLE_IDS[s] === handleId);
  return match ?? fallback;
}

export const DEFAULT_FILL = "#ffffff";
export const DEFAULT_STROKE = "#334155";
export const DEFAULT_TEXT = "#0f172a";
export const EDGE_STROKE = "#64748b";
export const FLOW_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
export const FLOW_FONT_SIZE = 13;
export const FLOW_LINE_HEIGHT = 17;

const clampSize = (v: number, min: number) =>
  Math.max(min, Math.min(MAX_NODE_SIZE, Math.round(v)));

/**
 * Single normaliser for node size: a custom w/h when present (clamped to the
 * kind minimum and the global ceiling), otherwise the kind default. Every
 * consumer — canvas, bounds, wrapping, export — routes through here so they
 * can never disagree.
 */
export function nodeSize(node: Pick<FlowNode, "kind" | "w" | "h">): { w: number; h: number } {
  const def = NODE_DEFAULTS[node.kind] ?? NODE_DEFAULTS.process;
  const min = NODE_MIN[node.kind] ?? NODE_MIN.process;
  const w = typeof node.w === "number" && Number.isFinite(node.w) ? clampSize(node.w, min.w) : def.w;
  const h = typeof node.h === "number" && Number.isFinite(node.h) ? clampSize(node.h, min.h) : def.h;
  return { w, h };
}

/** Short unique id for nodes/edges created in the editor. */
export function makeFlowId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** SVG path for a node shape in a w×h box with origin at top-left. */
export function nodePath(kind: FlowNodeKind, w: number, h: number): string {
  switch (kind) {
    case "terminator": {
      const r = h / 2;
      return `M ${r2(r)},0 H ${r2(w - r)} A ${r2(r)},${r2(r)} 0 0 1 ${r2(w - r)},${r2(h)} H ${r2(r)} A ${r2(r)},${r2(r)} 0 0 1 ${r2(r)},0 Z`;
    }
    case "decision":
      return `M ${r2(w / 2)},0 L ${r2(w)},${r2(h / 2)} L ${r2(w / 2)},${r2(h)} L 0,${r2(h / 2)} Z`;
    case "io": {
      const skew = Math.min(22, w * 0.18);
      return `M ${r2(skew)},0 H ${r2(w)} L ${r2(w - skew)},${r2(h)} H 0 Z`;
    }
    case "connector": {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${r2(rx)},0 A ${r2(rx)},${r2(ry)} 0 1 0 ${r2(rx)},${r2(h)} A ${r2(rx)},${r2(ry)} 0 1 0 ${r2(rx)},0 Z`;
    }
    case "process":
    default: {
      const r = 10;
      return `M ${r},0 H ${r2(w - r)} Q ${r2(w)},0 ${r2(w)},${r} V ${r2(h - r)} Q ${r2(w)},${r2(h)} ${r2(w - r)},${r2(h)} H ${r} Q 0,${r2(h)} 0,${r2(h - r)} V ${r} Q 0,0 ${r},0 Z`;
    }
  }
}

// How far a connector travels straight out of a shape before it may turn.
const LEAD = 16;

const OUTWARD: Record<FlowSide, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export type FlowAnchor = { x: number; y: number; side: FlowSide };

/** Handle point on a node's edge, in canvas coordinates. */
export function sideAnchor(node: FlowNode, side: FlowSide): { x: number; y: number } {
  const { w, h } = nodeSize(node);
  switch (side) {
    case "top":
      return { x: node.x + w / 2, y: node.y };
    case "bottom":
      return { x: node.x + w / 2, y: node.y + h };
    case "left":
      return { x: node.x, y: node.y + h / 2 };
    case "right":
      return { x: node.x + w, y: node.y + h / 2 };
  }
}

const isVerticalSide = (side: FlowSide) => side === "top" || side === "bottom";

const leadPoint = (a: FlowAnchor) => ({
  x: a.x + OUTWARD[a.side].x * LEAD,
  y: a.y + OUTWARD[a.side].y * LEAD,
});

/**
 * Drop duplicate points and midpoints that just sit on a straight run, so paths
 * stay compact. A point is only redundant when it lies *between* its neighbours
 * — a collinear point beyond them is a deliberate lead (or backtrack) and is kept.
 */
function simplify(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const between = (a: number, b: number, c: number) =>
    (a <= b && b <= c) || (a >= b && b >= c);
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && r2(prev.x) === r2(p.x) && r2(prev.y) === r2(p.y)) continue;
    while (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const horizontal =
        r2(a.y) === r2(b.y) && r2(b.y) === r2(p.y) && between(a.x, b.x, p.x);
      const vertical = r2(a.x) === r2(b.x) && r2(b.x) === r2(p.x) && between(a.y, b.y, p.y);
      if (!horizontal && !vertical) break;
      out.pop();
    }
    out.push(p);
  }
  return out;
}

/**
 * Orthogonal route between two anchors: out of the source side, into the target
 * side, via a single mid-run. Vertical-to-vertical keeps the classic bottom→top
 * elbow; mixed orientations turn once at the corner.
 */
export function edgePoints(from: FlowAnchor, to: FlowAnchor): { x: number; y: number }[] {
  const a = leadPoint(from);
  const b = leadPoint(to);
  const vFrom = isVerticalSide(from.side);
  const vTo = isVerticalSide(to.side);

  if (vFrom && vTo) {
    const midY = r2((a.y + b.y) / 2);
    return simplify([from, a, { x: a.x, y: midY }, { x: b.x, y: midY }, b, to]);
  }
  if (!vFrom && !vTo) {
    const midX = r2((a.x + b.x) / 2);
    return simplify([from, a, { x: midX, y: a.y }, { x: midX, y: b.y }, b, to]);
  }
  if (vFrom) return simplify([from, a, { x: a.x, y: b.y }, b, to]);
  return simplify([from, a, { x: b.x, y: a.y }, b, to]);
}

/** SVG path for a connector between two sided anchors. */
export function edgePath(from: FlowAnchor, to: FlowAnchor): string {
  const pts = edgePoints(from, to);
  return `M ${pts.map((p) => `${r2(p.x)},${r2(p.y)}`).join(" L ")}`;
}

/** Point halfway along the route (by length) — where a label sits. */
export function edgeMidpoint(from: FlowAnchor, to: FlowAnchor): { x: number; y: number } {
  const pts = edgePoints(from, to);
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  let remaining = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const len = Math.hypot(dx, dy);
    if (len > 0 && remaining <= len) {
      const t = remaining / len;
      return { x: r2(pts[i - 1].x + dx * t), y: r2(pts[i - 1].y + dy * t) };
    }
    remaining -= len;
  }
  const last = pts[pts.length - 1];
  return { x: r2(last.x), y: r2(last.y) };
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "'" ? "&apos;" : "&quot;"
  );
}

/**
 * Word-wrap a label to lines fitting maxWidth. `measure` returns the width of
 * a string in the same units as maxWidth (browser: canvas measureText width).
 * Preserves explicit newlines; hard-breaks words wider than the line.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let chunk = word;
      while (chunk.length > 1 && measure(chunk) > maxWidth) {
        let cut = chunk.length - 1;
        while (cut > 1 && measure(chunk.slice(0, cut)) > maxWidth) cut--;
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(chunk.slice(0, cut));
        chunk = chunk.slice(cut);
      }
      const trial = line ? `${line} ${chunk}` : chunk;
      if (!line || measure(trial) <= maxWidth) {
        line = trial;
      } else {
        lines.push(line);
        line = chunk;
      }
    }
    if (line) lines.push(line);
  }
  // All-blank input yields [""] — normalise to no lines.
  return lines.length > 0 && lines.every((l) => l === "") ? [] : lines;
}

export function nodeFill(node: Pick<FlowNode, "fill">): string {
  return node.fill || DEFAULT_FILL;
}

export function nodeStroke(node: Pick<FlowNode, "stroke">): string {
  return node.stroke || DEFAULT_STROKE;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Validate an optional handle id from a doc, with a user-facing message on failure. */
function sideHandleOrThrow(value: unknown, edgeId: string, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !FLOW_SIDES.some((s) => HANDLE_IDS[s] === value)) {
    throw new Error(`Connection "${edgeId}" has an unknown ${name}.`);
  }
  return value;
}

/** Parse + validate a flowchart JSON document. Throws with a user-facing message. */
export function parseFlowDoc(input: string): FlowDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error("That file isn't valid JSON — it can't be opened as a flowchart.");
  }
  if (!isRecord(raw)) throw new Error("That JSON isn't a flowchart (expected an object).");
  const nodes = raw.nodes;
  const edges = raw.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error("That JSON isn't a flowchart (needs \"nodes\" and \"edges\" arrays).");
  }
  if (nodes.length > 500) throw new Error("That flowchart has too many nodes (max 500).");
  if (edges.length > 1000) throw new Error("That flowchart has too many connections (max 1000).");

  const ids = new Set<string>();
  const parsedNodes: FlowNode[] = nodes.map((n, i) => {
    if (!isRecord(n)) throw new Error(`Node ${i + 1} is malformed.`);
    const { id, kind, x, y, label, fill, stroke, w, h } = n;
    if (typeof id !== "string" || !id) throw new Error(`Node ${i + 1} is missing an id.`);
    if (ids.has(id)) throw new Error(`Duplicate node id "${id}".`);
    ids.add(id);
    if (!NODE_KINDS.includes(kind as FlowNodeKind)) {
      throw new Error(`Node "${id}" has an unknown shape.`);
    }
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      throw new Error(`Node "${id}" has an invalid position.`);
    }
    if (w !== undefined && !isFiniteNumber(w)) {
      throw new Error(`Node "${id}" has an invalid width.`);
    }
    if (h !== undefined && !isFiniteNumber(h)) {
      throw new Error(`Node "${id}" has an invalid height.`);
    }
    if (typeof label !== "string") throw new Error(`Node "${id}" is missing its label.`);
    if (label.length > 500) throw new Error(`Node "${id}" has too much text (max 500 characters).`);
    if (fill !== undefined && typeof fill !== "string") throw new Error(`Node "${id}" has a bad fill colour.`);
    if (stroke !== undefined && typeof stroke !== "string") throw new Error(`Node "${id}" has a bad line colour.`);
    const size = nodeSize({ kind: kind as FlowNodeKind, w: w as number | undefined, h: h as number | undefined });
    return {
      id,
      kind: kind as FlowNodeKind,
      x: Math.max(-5000, Math.min(5000, x)),
      y: Math.max(-5000, Math.min(5000, y)),
      label: label.slice(0, 500),
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
      // Persist the clamped size only when the file actually resizes the shape.
      ...(w !== undefined && size.w !== NODE_DEFAULTS[kind as FlowNodeKind].w ? { w: size.w } : {}),
      ...(h !== undefined && size.h !== NODE_DEFAULTS[kind as FlowNodeKind].h ? { h: size.h } : {}),
    };
  });

  const parsedEdges: FlowEdge[] = edges.map((e, i) => {
    if (!isRecord(e)) throw new Error(`Connection ${i + 1} is malformed.`);
    const { id, source, target, label, sourceHandle, targetHandle } = e;
    if (typeof id !== "string" || !id) throw new Error(`Connection ${i + 1} is missing an id.`);
    if (typeof source !== "string" || !ids.has(source)) {
      throw new Error(`Connection "${id}" points from an unknown node.`);
    }
    if (typeof target !== "string" || !ids.has(target)) {
      throw new Error(`Connection "${id}" points to an unknown node.`);
    }
    if (label !== undefined && typeof label !== "string") {
      throw new Error(`Connection "${id}" has a bad label.`);
    }
    if (typeof label === "string" && label.length > 200) {
      throw new Error(`Connection "${id}" has too much label text (max 200 characters).`);
    }
    const src = sideHandleOrThrow(sourceHandle, id, "source side");
    const tgt = sideHandleOrThrow(targetHandle, id, "target side");
    return {
      id,
      source,
      target,
      ...(label ? { label: label.slice(0, 200) } : {}),
      // Only persist a non-default side, so plain docs stay tidy.
      ...(src && sideFromHandle(src) !== "bottom" ? { sourceHandle: src } : {}),
      ...(tgt && sideFromHandle(tgt, "top") !== "top" ? { targetHandle: tgt } : {}),
    };
  });

  return { version: 1, nodes: parsedNodes, edges: parsedEdges };
}

export function serializeFlowDoc(doc: FlowDoc): string {
  return JSON.stringify({ version: 1, nodes: doc.nodes, edges: doc.edges }, null, 2);
}

/** Bounding box of all nodes plus padding (for export framing). */
export function docBounds(doc: FlowDoc, padding = 48): { x: number; y: number; w: number; h: number } {
  if (doc.nodes.length === 0) return { x: 0, y: 0, w: 480, h: 320 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of doc.nodes) {
    const { w, h } = nodeSize(n);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  }
  return {
    x: Math.floor(minX - padding),
    y: Math.floor(minY - padding),
    w: Math.ceil(maxX - minX + padding * 2),
    h: Math.ceil(maxY - minY + padding * 2),
  };
}

const nodeById = (doc: FlowDoc, id: string) => doc.nodes.find((n) => n.id === id);

function nodeTextLines(node: FlowNode, measure: (s: string) => number): string[] {
  const { w } = nodeSize(node);
  return wrapText(node.label, Math.max(24, w - 24), measure);
}

/** Render one node as SVG content (shape + centred wrapped label). */
export function nodeToSvg(node: FlowNode, measure: (s: string) => number): string {
  const { w, h } = nodeSize(node);
  const lines = nodeTextLines(node, measure);
  const cx = r2(w / 2);
  const startY = r2(h / 2 - ((lines.length - 1) * FLOW_LINE_HEIGHT) / 2);
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${cx}" dy="${i === 0 ? 0 : FLOW_LINE_HEIGHT}">${escapeXml(line) || " "}</tspan>`
    )
    .join("");
  const text =
    lines.length === 0
      ? ""
      : `<text x="${cx}" y="${startY}" text-anchor="middle" dominant-baseline="central" font-family="${FLOW_FONT}" font-size="${FLOW_FONT_SIZE}" fill="${DEFAULT_TEXT}">${tspans}</text>`;
  return `<g transform="translate(${r2(node.x)},${r2(node.y)})"><path d="${nodePath(node.kind, w, h)}" fill="${escapeXml(nodeFill(node))}" stroke="${escapeXml(nodeStroke(node))}" stroke-width="2"/>${text}</g>`;
}

/** Assemble a standalone SVG of the whole document (v1: bottom→top connections). */
export function flowToSvg(doc: FlowDoc, measure: (s: string) => number): string {
  const bounds = docBounds(doc);
  const parts: string[] = [
    `<defs><marker id="flow-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="${EDGE_STROKE}"/></marker></defs>`,
    `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="#ffffff"/>`,
  ];
  for (const e of doc.edges) {
    const s = nodeById(doc, e.source);
    const t = nodeById(doc, e.target);
    if (!s || !t) continue;
    const from = { ...sideAnchor(s, sideFromHandle(e.sourceHandle, "bottom")), side: sideFromHandle(e.sourceHandle, "bottom") };
    const to = { ...sideAnchor(t, sideFromHandle(e.targetHandle, "top")), side: sideFromHandle(e.targetHandle, "top") };
    parts.push(
      `<path d="${edgePath(from, to)}" fill="none" stroke="${EDGE_STROKE}" stroke-width="2" marker-end="url(#flow-arrow)"/>`
    );
    if (e.label) {
      const mid = edgeMidpoint(from, to);
      parts.push(
        `<text x="${mid.x}" y="${r2(mid.y - 6)}" text-anchor="middle" font-family="${FLOW_FONT}" font-size="12" fill="${EDGE_STROKE}" stroke="#ffffff" stroke-width="4" paint-order="stroke">${escapeXml(e.label)}</text>`
      );
    }
  }
  for (const n of doc.nodes) parts.push(nodeToSvg(n, measure));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.w}" height="${bounds.h}" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}">${parts.join("")}</svg>`;
}

/** Starter diagram shown by the Sample button. */
export function sampleFlowDoc(): FlowDoc {
  return {
    version: 1,
    nodes: [
      { id: "start", kind: "terminator", x: 60, y: 24, label: "Start" },
      { id: "process-1", kind: "process", x: 55, y: 124, label: "Do the work" },
      { id: "decision-1", kind: "decision", x: 55, y: 248, label: "Did it work?" },
      { id: "end", kind: "terminator", x: 60, y: 408, label: "End" },
    ],
    edges: [
      { id: "e1", source: "start", target: "process-1" },
      { id: "e2", source: "process-1", target: "decision-1" },
      { id: "e3", source: "decision-1", target: "end", label: "yes" },
    ],
  };
}
