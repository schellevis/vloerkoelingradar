// web/test/data.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { isStale, loadForecast, validateForecast } from "../data.js";

const VALID = {
  generated_at: "2026-06-17T14:00:00+02:00",
  hours: ["2026-06-17T00:00", "2026-06-17T01:00"],
  places: [{ name: "Gouda", dewpoint: [12, 13], temp: [16, 15] }],
};

test("validateForecast passes a well-formed forecast", () => {
  assert.equal(validateForecast(VALID), VALID);
});

test("validateForecast rejects malformed data", () => {
  assert.throws(() => validateForecast(null));
  assert.throws(() => validateForecast({ ...VALID, places: [] }));
  assert.throws(() => validateForecast({ ...VALID, generated_at: "niet-een-datum" }));
  // lengte-mismatch
  assert.throws(() =>
    validateForecast({ ...VALID, places: [{ name: "X", dewpoint: [12], temp: [16, 15] }] }));
  // niet-finite waarde
  assert.throws(() =>
    validateForecast({ ...VALID, places: [{ name: "X", dewpoint: [12, null], temp: [16, 15] }] }));
});

test("validateForecast accepts optional summary, rejects non-string", () => {
  assert.equal(validateForecast({ ...VALID, summary: "Landelijke indruk." }).summary,
    "Landelijke indruk.");
  assert.equal(validateForecast(VALID), VALID); // summary mag ontbreken
  assert.throws(() => validateForecast({ ...VALID, summary: 42 }));
});

test("isStale true beyond staleHours", () => {
  const gen = "2026-06-17T00:00:00+02:00";
  const now = Date.parse("2026-06-17T11:00:00+02:00");
  assert.equal(isStale(gen, now, 12), false);
  assert.equal(isStale(gen, Date.parse("2026-06-17T13:00:00+02:00"), 12), true);
});

test("loadForecast revalidates via no-cache without a per-load query buster", async () => {
  let seenUrl, seenInit;
  const fakeFetch = async (url, init) => {
    seenUrl = url;
    seenInit = init;
    return { ok: true, json: async () => ({ ok: 1 }) };
  };
  const data = await loadForecast(fakeFetch);
  assert.deepEqual(data, { ok: 1 });
  // Geen "?v="-buster: die zou de cache per load nutteloos maken. De ETag van
  // GitHub Pages revalideert (no-cache) en fungeert als content-buster.
  assert.ok(!seenUrl.includes("?v="));
  assert.equal(seenInit.cache, "no-cache");
});
