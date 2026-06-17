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
});

test("round-trips saved prefs", () => {
  const s = memStorage();
  savePrefs({ placeName: "Gouda", margin: 3, minSupply: 17 }, s);
  assert.deepEqual(loadPrefs(s), { placeName: "Gouda", margin: 3, minSupply: 17 });
});

test("corrupt json falls back to defaults", () => {
  const s = memStorage();
  s.setItem("vkr.prefs", "{not json");
  assert.deepEqual(loadPrefs(s), { placeName: null, margin: 2, minSupply: 16 });
});
