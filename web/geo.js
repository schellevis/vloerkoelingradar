// web/geo.js
const R = 6371; // km
const rad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestPoint(target, points) {
  let best = -1;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = haversineKm(target, p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function makeProjection(bbox, width, height, pad = 0) {
  const { minLat, maxLat, minLon, maxLon } = bbox;
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos(rad(midLat));
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const w = width - 2 * pad;
  const h = height - 2 * pad;
  return ({ lat, lon }) => ({
    x: pad + ((lon - minLon) * kx) / spanX * w,
    y: pad + (maxLat - lat) / spanY * h, // noord boven
  });
}
