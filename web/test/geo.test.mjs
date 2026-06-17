// web/test/geo.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { haversineKm, nearestPoint, makeProjection } from "../geo.js";

test("haversine Amsterdam-Rotterdam ~ 57-58 km", () => {
  const d = haversineKm({ lat: 52.374, lon: 4.89 }, { lat: 51.922, lon: 4.479 });
  assert.ok(d > 50 && d < 65, `kreeg ${d}`);
});

test("nearestPoint picks closest index", () => {
  const pts = [{ lat: 53.2, lon: 6.5 }, { lat: 52.0, lon: 4.7 }, { lat: 50.85, lon: 5.69 }];
  assert.equal(nearestPoint({ lat: 52.09, lon: 5.12 }, pts), 1);
  assert.equal(nearestPoint({ lat: 0, lon: 0 }, []), -1);
});

test("projection maps corners within bounds, north is small y", () => {
  const proj = makeProjection({ minLat: 50.7, maxLat: 53.6, minLon: 3.3, maxLon: 7.2 }, 200, 230);
  const north = proj({ lat: 53.6, lon: 5 });
  const south = proj({ lat: 50.7, lon: 5 });
  assert.ok(north.y < south.y);
  assert.ok(north.y >= 0 && south.y <= 230);
});
