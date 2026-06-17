// web/days.js

// De uurlabels zijn kale Europe/Amsterdam-wandklok-tijden zonder offset. Parse ze
// als UTC-getal zodat vergelijken NIET afhangt van de timezone van het apparaat
// (anders springt "nu" mis voor bezoekers buiten NL of rond zomertijd).
export function wallClockMs(label) {
  const [d, t = "00:00"] = label.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return Date.UTC(y, mo - 1, da, h, mi || 0);
}

// Huidige Amsterdamse wandklok-tijd als label "YYYY-MM-DDTHH:MM", ongeacht de
// timezone van het apparaat (via de IANA-zone Europe/Amsterdam).
export function amsterdamNowLabel(date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
    .formatToParts(date)
    .reduce((o, x) => ((o[x.type] = x.value), o), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// nowMs is een wandklok-getal (zie wallClockMs), in dezelfde ruimte als de labels.
export function nearestHourIndex(hours, nowMs) {
  let best = 0;
  let bestD = Infinity;
  hours.forEach((h, i) => {
    const d = Math.abs(wallClockMs(h) - nowMs);
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
