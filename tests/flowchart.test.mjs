import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NODE_SIZE,
  NODE_DEFAULTS,
  NODE_MIN,
  docBounds,
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

test("edgePath: straight when aligned, elbow otherwise", () => {
  assert.equal(edgePath(10, 0, 10, 40), "M 10,0 V 40");
  assert.equal(edgePath(0, 0, 40, 40), "M 0,0 V 20 H 40 V 40");
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

test("docBounds + flowToSvg: reflect a resized node", () => {
  const doc = sampleFlowDoc();
  doc.nodes[1].w = 400;
  const b = docBounds(doc);
  assert.equal(b.w, 400 + 48 * 2);
  const svg = flowToSvg(doc, measure);
  assert.ok(svg.includes('width="496"'));
});
