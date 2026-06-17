// web/test/days.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { nearestHourIndex, groupByDay } from "../days.js";

const HOURS = ["2026-06-17T00:00", "2026-06-17T13:00", "2026-06-17T14:00", "2026-06-18T00:00"];
const DEW = [12, 17, 16, 11];

test("nearestHourIndex rounds to closest label (local time)", () => {
  assert.equal(nearestHourIndex(HOURS, new Date("2026-06-17T13:40")), 2); // dichter bij 14:00
  assert.equal(nearestHourIndex(HOURS, new Date("2026-06-17T13:10")), 1);
});

test("groupByDay splits on calendar day with min/max", () => {
  const days = groupByDay(HOURS, DEW);
  assert.equal(days.length, 2);
  assert.deepEqual(days[0], { date: "2026-06-17", indices: [0, 1, 2], min: 12, max: 17 });
  assert.deepEqual(days[1], { date: "2026-06-18", indices: [3], min: 11, max: 11 });
});
