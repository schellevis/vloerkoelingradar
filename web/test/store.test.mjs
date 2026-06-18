// web/test/store.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPrefs, savePrefs } from "../store.js";

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

test("defaults when empty", () => {
  const p = loadPrefs(memStorage());
  assert.equal(p.placeName, null);
  assert.equal(p.margin, 2);
  assert.equal(p.minSupply, 16);
  assert.equal(p.viewDays, 4);
});

test("round-trips saved prefs", () => {
  const s = memStorage();
  savePrefs({ placeName: "Gouda", margin: 3, minSupply: 17, viewDays: 7 }, s);
  assert.deepEqual(loadPrefs(s), { placeName: "Gouda", margin: 3, minSupply: 17, viewDays: 7 });
});

test("invalid viewDays falls back to default", () => {
  const s = memStorage();
  s.setItem("vkr.prefs", JSON.stringify({ viewDays: 99 }));
  assert.equal(loadPrefs(s).viewDays, 4);
});

test("corrupt json falls back to defaults", () => {
  const s = memStorage();
  s.setItem("vkr.prefs", "{not json");
  assert.deepEqual(loadPrefs(s), { placeName: null, margin: 2, minSupply: 16, viewDays: 4 });
});

test("out-of-range prefs are clamped to CONFIG limits", () => {
  const s = memStorage();
  s.setItem("vkr.prefs", JSON.stringify({ placeName: "Gouda", margin: -100, minSupply: 1000 }));
  const p = loadPrefs(s);
  assert.equal(p.margin, 0);       // CONFIG.limits.margin.max/min
  assert.equal(p.minSupply, 22);   // CONFIG.limits.minSupply.max
});
