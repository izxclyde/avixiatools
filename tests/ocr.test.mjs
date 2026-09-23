import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bboxToTextPlacement,
  collectWords,
  hasTextLayer,
  normalizeRotation,
  unrotateBbox,
  visualSize,
} from "../lib/logic/ocr.ts";

// A 200x100pt page rendered at 2x, no page rotation, crop box at the origin.
const flat = {
  scale: 2,
  originX: 0,
  originY: 0,
  width: 200,
  height: 100,
  rotation: 0,
};

test("ocr: normalizeRotation snaps to the four real rotations", () => {
  assert.equal(normalizeRotation(0), 0);
  assert.equal(normalizeRotation(90), 90);
  assert.equal(normalizeRotation(180), 180);
  assert.equal(normalizeRotation(270), 270);
  assert.equal(normalizeRotation(360), 0);
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(450), 90);
});

test("ocr: visualSize swaps axes only for 90/270", () => {
  assert.deepEqual(visualSize(200, 100, 0), { width: 200, height: 100 });
  assert.deepEqual(visualSize(200, 100, 90), { width: 100, height: 200 });
  assert.deepEqual(visualSize(200, 100, 180), { width: 200, height: 100 });
  assert.deepEqual(visualSize(200, 100, 270), { width: 100, height: 200 });
});

test("ocr: unrotated page maps px → points with a flipped y axis", () => {
  // bbox x 20–60px, y 10–30px at 2x → 10–30pt across, 15pt from the top.
  const box = { x0: 20, y0: 10, x1: 60, y1: 30 };
  const placement = bboxToTextPlacement(box, flat);
  assert.equal(placement.x, 10);
  assert.equal(placement.y, 85); // 100 - 30/2
  assert.equal(placement.size, 10); // 20px tall ÷ 2
  assert.equal(placement.rotate, 0);
});

/** Forward path: user-space point → visual point for a clockwise page rotate. */
function toVisual(x, y, width, height, rotation) {
  switch (rotation) {
    case 90:
      return [y, width - x];
    case 180:
      return [width - x, height - y];
    case 270:
      return [height - y, x];
    default:
      return [x, y];
  }
}

// Each case is checked by mapping back through the forward rotation, so a
// mirrored or transposed quadrant fails rather than silently agreeing.
const rotatedCases = [
  { rotation: 90, expected: { x: 15, y: 10 } },
  { rotation: 180, expected: { x: 190, y: 15 } },
  { rotation: 270, expected: { x: 185, y: 90 } },
];

for (const { rotation, expected } of rotatedCases) {
  test(`ocr: page /Rotate ${rotation} lands in the right quadrant`, () => {
    const placement = bboxToTextPlacement(
      { x0: 20, y0: 10, x1: 60, y1: 30 },
      { ...flat, rotation }
    );
    assert.equal(placement.x, expected.x);
    assert.equal(placement.y, expected.y);
    assert.equal(placement.rotate, rotation);

    // The bbox's baseline-left corner was 10pt across, 15pt down from the top.
    const visual = visualSize(flat.width, flat.height, rotation);
    const [vx, vy] = toVisual(
      placement.x,
      placement.y,
      flat.width,
      flat.height,
      rotation
    );
    assert.ok(Math.abs(vx - 10) < 1e-9, `vx ${vx}`);
    assert.ok(Math.abs(vy - (visual.height - 15)) < 1e-9, `vy ${vy}`);
  });
}

test("ocr: crop-box origin offsets the placement", () => {
  const placement = bboxToTextPlacement(
    { x0: 20, y0: 10, x1: 60, y1: 30 },
    { ...flat, originX: 12, originY: 34 }
  );
  assert.equal(placement.x, 22);
  assert.equal(placement.y, 119);
});

test("ocr: font size is clamped to a sane range", () => {
  assert.equal(bboxToTextPlacement({ x0: 0, y0: 5, x1: 10, y1: 5 }, flat).size, 1);
  assert.equal(bboxToTextPlacement({ x0: 0, y0: 0, x1: 10, y1: 5000 }, flat).size, 300);
});

test("ocr: hasTextLayer ignores blank and tiny text layers", () => {
  assert.equal(hasTextLayer(""), false);
  assert.equal(hasTextLayer("   \n\t "), false);
  assert.equal(hasTextLayer("abc"), false);
  assert.equal(hasTextLayer("Page one of two"), true);
});

test("ocr: collectWords flattens nested blocks and drops malformed words", () => {
  const blocks = [
    {
      paragraphs: [
        {
          lines: [
            {
              words: [
                { text: " hello ", bbox: { x0: 1, y0: 2, x1: 9, y1: 6 } },
                { text: "", bbox: { x0: 1, y0: 2, x1: 9, y1: 6 } },
                { text: "no-box" },
                { text: "inverted", bbox: { x0: 9, y0: 2, x1: 1, y1: 6 } },
                { text: "nan", bbox: { x0: Number.NaN, y0: 2, x1: 9, y1: 6 } },
              ],
            },
          ],
        },
      ],
    },
    {},
  ];

  assert.deepEqual(collectWords(blocks), [
    { text: "hello", bbox: { x0: 1, y0: 2, x1: 9, y1: 6 } },
  ]);
  assert.deepEqual(collectWords(null), []);
  assert.deepEqual(collectWords("garbage"), []);
});

test("ocr: unrotateBbox is identity at zero and rotation-invariant for a centred box", () => {
  const box = { x0: 40, y0: 40, x1: 60, y1: 60 };
  assert.deepEqual(unrotateBbox(box, 0, 100, 100), box);

  // A centred box rotated 90° on a square canvas maps back onto itself.
  const spun = unrotateBbox(box, Math.PI / 2, 100, 100);
  for (const key of ["x0", "y0", "x1", "y1"]) {
    assert.ok(Math.abs(spun[key] - box[key]) < 1e-9, `${key}: ${spun[key]}`);
  }
});

test("ocr: auto-rotated boxes still place inside the page", () => {
  const bbox = unrotateBbox({ x0: 400, y0: 120, x1: 520, y1: 160 }, 0.05, 1000, 1400);
  const placement = bboxToTextPlacement(bbox, {
    scale: 2,
    originX: 0,
    originY: 0,
    width: 500,
    height: 700,
    rotation: 0,
  });
  assert.ok(Number.isFinite(placement.x) && Number.isFinite(placement.y));
  assert.ok(placement.x >= 0 && placement.x <= 500);
  assert.ok(placement.y >= 0 && placement.y <= 700);
  assert.ok(placement.size > 0);
});
