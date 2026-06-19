// web/test/views.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { dewToScale, bboxOf, summaryParagraphs } from "../views.js";

test("dewToScale clamps to 0..1 over dewAxis 8..22", () => {
  assert.equal(dewToScale(8), 0);
  assert.equal(dewToScale(22), 1);
  assert.equal(dewToScale(15), 0.5);
  assert.equal(dewToScale(4), 0);
  assert.equal(dewToScale(30), 1);
});

test("bboxOf covers all points", () => {
  const b = bboxOf([{ lat: 51, lon: 4 }, { lat: 53, lon: 6 }]);
  assert.deepEqual(b, { minLat: 51, maxLat: 53, minLon: 4, maxLon: 6 });
});

test("summaryParagraphs splits on blank lines and trims", () => {
  assert.deepEqual(summaryParagraphs("Eerste alinea.\n\n  Tweede.  "), [
    "Eerste alinea.",
    "Tweede.",
  ]);
  assert.deepEqual(summaryParagraphs("  enkel  "), ["enkel"]);
  assert.deepEqual(summaryParagraphs(""), []);
  assert.deepEqual(summaryParagraphs(null), []);
  assert.deepEqual(summaryParagraphs(undefined), []);
});
