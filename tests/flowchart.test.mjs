import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NODE_SIZE,
  NODE_DEFAULTS,
  NODE_MIN,
  docBounds,
  edgeMidpoint,
  edgePath,
  escapeXml,
  flowToSvg,
  nodePath,
  nodeSize,
  parseFlowDoc,
  sampleFlowDoc,
  serializeFlowDoc,
  wrapText,
} from "../lib/logic/flowchart.ts";

// ponytail: fake measure (6px/char) keeps wrapping tests DOM-free.
const measure = (s) => s.length * 6;

test("wrapText: wraps on words", () => {
  const lines = wrapText("hello world foo", 60, measure);
  assert.deepEqual(lines, ["hello", "world foo"]);
});

test("wrapText: hard-breaks long words", () => {
  const lines = wrapText("abcdefghij", 18, measure);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(""), "abcdefghij");
});

test("wrapText: empty + blank input", () => {
  assert.deepEqual(wrapText("", 100, measure), []);
  assert.deepEqual(wrapText("   ", 100, measure), []);
});

test("wrapText: preserves newlines", () => {
  assert.deepEqual(wrapText("a\nb", 100, measure), ["a", "b"]);
});

test("nodePath: one closed path per shape", () => {
  for (const kind of ["terminator", "process", "decision", "io", "connector"]) {
    const d = nodePath(kind, 170, 84);
    assert.ok(d.startsWith("M"), kind);
    assert.ok(d.endsWith("Z"), kind);
  }
});

test("edgePath: aligned bottom→top collapses to a straight run", () => {
  const d = edgePath({ x: 10, y: 0, side: "bottom" }, { x: 10, y: 40, side: "top" });
  assert.equal(d, "M 10,0 L 10,40");
});

test("edgePath: bottom→top routes through a mid-run", () => {
  const d = edgePath({ x: 0, y: 0, side: "bottom" }, { x: 40, y: 40, side: "top" });
  assert.equal(d, "M 0,0 L 0,20 L 40,20 L 40,40");
});

test("edgePath: side→side uses a horizontal mid-run", () => {
  const d = edgePath({ x: 0, y: 0, side: "right" }, { x: 40, y: 40, side: "left" });
  assert.equal(d, "M 0,0 L 20,0 L 20,40 L 40,40");
});

test("edgePath: mixed sides turn once and keep the lead into the target", () => {
  const d = edgePath({ x: 0, y: 0, side: "bottom" }, { x: 40, y: 40, side: "right" });
  assert.equal(d, "M 0,0 L 0,40 L 56,40 L 40,40");
});

test("edgeMidpoint: sits halfway along the route", () => {
  const mid = edgeMidpoint({ x: 0, y: 0, side: "bottom" }, { x: 40, y: 40, side: "top" });
  assert.deepEqual(mid, { x: 20, y: 20 });
});

test("escapeXml: escapes markup", () => {
  assert.equal(escapeXml('<a>&"\'</a>'), "&lt;a&gt;&amp;&quot;&apos;&lt;/a&gt;");
});

test("parseFlowDoc: round-trips the sample", () => {
  const doc = sampleFlowDoc();
  const back = parseFlowDoc(serializeFlowDoc(doc));
  assert.deepEqual(back, doc);
});

test("parseFlowDoc: rejects bad input", () => {
  assert.throws(() => parseFlowDoc("nope"), /valid JSON/);
  assert.throws(() => parseFlowDoc('{"a":1}'), /nodes.*edges/);
  assert.throws(
    () => parseFlowDoc('{"nodes":[],"edges":[{"id":"e","source":"x","target":"y"}]}'),
    /unknown node/
  );
  assert.throws(
    () =>
      parseFlowDoc(
        '{"nodes":[{"id":"a","kind":"nope","x":0,"y":0,"label":""}],"edges":[]}'
      ),
    /unknown shape/
  );
});

test("flowToSvg: contains every node and edge", () => {
  const doc = sampleFlowDoc();
  const svg = flowToSvg(doc, measure);
  assert.ok(svg.startsWith("<svg"));
  for (const n of doc.nodes) assert.ok(svg.includes(escapeXml(n.label)), n.id);
  assert.ok(svg.includes("flow-arrow"));
  assert.ok(svg.includes("yes"));
});

test("flowToSvg: escapes labels", () => {
  const doc = sampleFlowDoc();
  doc.nodes[0].label = "<b>&</b>";
  const svg = flowToSvg(doc, measure);
  assert.ok(svg.includes("&lt;b&gt;&amp;&lt;/b&gt;"));
  assert.ok(!svg.includes("<b>&</b>"));
});

test("docBounds: empty doc gets a default frame", () => {
  const b = docBounds({ version: 1, nodes: [], edges: [] });
  assert.ok(b.w > 0 && b.h > 0);
});

test("nodeSize: defaults when no custom size", () => {
  assert.deepEqual(nodeSize({ kind: "process" }), NODE_DEFAULTS.process);
});

test("nodeSize: honours custom sizes", () => {
  assert.deepEqual(nodeSize({ kind: "process", w: 400, h: 200 }), { w: 400, h: 200 });
});

test("nodeSize: clamps below minimum and above ceiling", () => {
  assert.deepEqual(nodeSize({ kind: "process", w: 1, h: 1 }), NODE_MIN.process);
  assert.deepEqual(nodeSize({ kind: "process", w: 5000, h: 5000 }), {
    w: MAX_NODE_SIZE,
    h: MAX_NODE_SIZE,
  });
});

test("nodeSize: non-finite sizes fall back to defaults", () => {
  assert.deepEqual(nodeSize({ kind: "process", w: NaN, h: NaN }), NODE_DEFAULTS.process);
});

test("parseFlowDoc: rejects non-finite sizes", () => {
  assert.throws(
    () =>
      parseFlowDoc(
        '{"nodes":[{"id":"a","kind":"process","x":0,"y":0,"label":"","w":"big"}],"edges":[]}'
      ),
    /invalid width/
  );
  assert.throws(
    () =>
      parseFlowDoc(
        '{"nodes":[{"id":"a","kind":"process","x":0,"y":0,"label":"","h":null}],"edges":[]}'
      ),
    /invalid height/
  );
});

test("parseFlowDoc: clamps out-of-range sizes on import", () => {
  const doc = parseFlowDoc(
    '{"nodes":[{"id":"a","kind":"process","x":0,"y":0,"label":"","w":1,"h":5000}],"edges":[]}'
  );
  assert.deepEqual({ w: doc.nodes[0].w, h: doc.nodes[0].h }, {
    w: NODE_MIN.process.w,
    h: MAX_NODE_SIZE,
  });
});

test("parseFlowDoc: round-trips a resized node", () => {
  const doc = sampleFlowDoc();
  doc.nodes[1].w = 400;
  doc.nodes[1].h = 200;
  const back = parseFlowDoc(serializeFlowDoc(doc));
  assert.deepEqual(back, doc);
});

test("parseFlowDoc: round-trips connector sides", () => {
  const doc = sampleFlowDoc();
  doc.edges[0].sourceHandle = "r";
  doc.edges[0].targetHandle = "l";
  const back = parseFlowDoc(serializeFlowDoc(doc));
  assert.deepEqual(back, doc);
});

test("parseFlowDoc: drops default sides so plain docs stay tidy", () => {
  const doc = sampleFlowDoc();
  doc.edges[0].sourceHandle = "b";
  doc.edges[0].targetHandle = "t";
  const back = parseFlowDoc(serializeFlowDoc(doc));
  assert.equal(back.edges[0].sourceHandle, undefined);
  assert.equal(back.edges[0].targetHandle, undefined);
});

test("parseFlowDoc: docs without sides still load (v1 files)", () => {
  const doc = parseFlowDoc(
    '{"nodes":[{"id":"a","kind":"process","x":0,"y":0,"label":""},{"id":"b","kind":"process","x":0,"y":200,"label":""}],"edges":[{"id":"e","source":"a","target":"b"}]}'
  );
  assert.equal(doc.edges[0].sourceHandle, undefined);
  assert.equal(doc.edges[0].targetHandle, undefined);
});

test("parseFlowDoc: rejects an unknown side", () => {
  assert.throws(
    () =>
      parseFlowDoc(
        '{"nodes":[{"id":"a","kind":"process","x":0,"y":0,"label":""}],"edges":[{"id":"e","source":"a","target":"a","sourceHandle":"z"}]}'
      ),
    /unknown source side/
  );
});

test("flowToSvg: routes a connection from the side it was drawn from", () => {
  const doc = sampleFlowDoc();
  doc.edges[0].sourceHandle = "r";
  doc.edges[0].targetHandle = "l";
  const svg = flowToSvg(doc, measure);
  // Leaves the right of `start` (60+160, 24+30) and enters the left of
  // `process-1` (55, 124+42), with the 16px lead kept on both ends.
  assert.ok(
    svg.includes("M 220,54 L 236,54 L 137.5,54 L 137.5,166 L 39,166 L 55,166"),
    svg.slice(0, 600)
  );
});

test("docBounds + flowToSvg: reflect a resized node", () => {
  const doc = sampleFlowDoc();
  doc.nodes[1].w = 400;
  const b = docBounds(doc);
  assert.equal(b.w, 400 + 48 * 2);
  const svg = flowToSvg(doc, measure);
  assert.ok(svg.includes('width="496"'));
});
