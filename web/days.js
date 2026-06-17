// web/days.js
export function nearestHourIndex(hours, now) {
  const t = now.getTime();
  let best = 0;
  let bestD = Infinity;
  hours.forEach((h, i) => {
    const d = Math.abs(new Date(h).getTime() - t);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function groupByDay(hours, dewpoint) {
  const map = new Map();
  hours.forEach((h, i) => {
    const date = h.slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(i);
  });
  return [...map.entries()].map(([date, indices]) => {
    const vals = indices.map((i) => dewpoint[i]).filter((v) => v != null);
    const min = vals.length ? Math.min(...vals) : null;
    const max = vals.length ? Math.max(...vals) : null;
    return { date, indices, min, max };
  });
}
