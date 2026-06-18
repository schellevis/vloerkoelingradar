// web/test/config.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../config.js";

test("levels ascending and terminated by Infinity", () => {
  const ups = CONFIG.levels.map((l) => l.upTo);
  assert.deepEqual(ups, [...ups].sort((a, b) => a - b));
  assert.equal(CONFIG.levels.at(-1).upTo, Infinity);
});

test("defaults match spec", () => {
  assert.equal(CONFIG.defaults.margin, 2);
  assert.equal(CONFIG.defaults.minSupply, 16);
  assert.equal(CONFIG.staleHours, 12);
  assert.deepEqual(CONFIG.dewAxis, { min: 8, max: 22 });
});
