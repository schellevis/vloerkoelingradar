// web/test/days.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { nearestHourIndex, groupByDay, wallClockMs, amsterdamNowLabel, endIndexForDays } from "../days.js";

const HOURS = ["2026-06-17T00:00", "2026-06-17T13:00", "2026-06-17T14:00", "2026-06-18T00:00"];
const DEW = [12, 17, 16, 11];

test("nearestHourIndex rounds to closest label (timezone-independent)", () => {
  assert.equal(nearestHourIndex(HOURS, wallClockMs("2026-06-17T13:40")), 2); // dichter bij 14:00
  assert.equal(nearestHourIndex(HOURS, wallClockMs("2026-06-17T13:10")), 1);
});

test("amsterdamNowLabel converts any instant to Amsterdam wall-clock", () => {
  // 00:30 UTC op 17 juni = zomertijd (UTC+2) = 02:30 Amsterdam
  assert.equal(amsterdamNowLabel(new Date("2026-06-17T00:30:00Z")), "2026-06-17T02:30");
  // 23:30 UTC = 01:30 Amsterdam de volgende dag
  assert.equal(amsterdamNowLabel(new Date("2026-06-17T23:30:00Z")), "2026-06-18T01:30");
});

test("nearestHourIndex is independent of device timezone for a fixed instant", () => {
  // Een vast UTC-moment levert hetzelfde gekozen uur, ongeacht apparaat-zone.
  const ms = wallClockMs(amsterdamNowLabel(new Date("2026-06-17T11:55:00Z"))); // 13:55 Adam
  assert.equal(nearestHourIndex(HOURS, ms), 2); // 14:00
});

test("endIndexForDays returns last index of Nth calendar day", () => {
  assert.equal(endIndexForDays(HOURS, 1), 2); // dag 17 juni: indices 0,1,2 -> laatste is 2
  assert.equal(endIndexForDays(HOURS, 2), 3); // dag 18 juni: index 3
  assert.equal(endIndexForDays(HOURS, 99), 3); // meer dagen dan data: geeft laatste index
});

test("groupByDay splits on calendar day with min/max", () => {
  const days = groupByDay(HOURS, DEW);
  assert.equal(days.length, 2);
  assert.deepEqual(days[0], { date: "2026-06-17", indices: [0, 1, 2], min: 12, max: 17 });
  assert.deepEqual(days[1], { date: "2026-06-18", indices: [3], min: 11, max: 11 });
});
