// web/test/data.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { isStale, loadForecast } from "../data.js";

test("isStale true beyond staleHours", () => {
  const gen = "2026-06-17T00:00:00+02:00";
  const now = Date.parse("2026-06-17T11:00:00+02:00");
  assert.equal(isStale(gen, now, 12), false);
  assert.equal(isStale(gen, Date.parse("2026-06-17T13:00:00+02:00"), 12), true);
});

test("loadForecast uses no-store and returns json", async () => {
  let seenInit;
  const fakeFetch = async (url, init) => {
    seenInit = init;
    assert.ok(url.includes("?v="));
    return { ok: true, json: async () => ({ ok: 1 }) };
  };
  const data = await loadForecast(fakeFetch);
  assert.deepEqual(data, { ok: 1 });
  assert.equal(seenInit.cache, "no-store");
});
