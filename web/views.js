// web/views.js
import { CONFIG } from "./config.js";
import { classify, recommendedSupply } from "./model.js";
import { makeProjection } from "./geo.js";
import { groupByDay } from "./days.js";

const cssColor = (varName) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#888";

// --- Pure helpers (getest met node:test) -------------------------------------

export function dewToScale(dew) {
  const { min, max } = CONFIG.dewAxis;
  const span = max - min || 1; // voorkom deling door nul bij config-misconfiguratie
  return Math.max(0, Math.min(1, (dew - min) / span));
}

export function bboxOf(points) {
  return {
    minLat: Math.min(...points.map((p) => p.lat)),
    maxLat: Math.max(...points.map((p) => p.lat)),
    minLon: Math.min(...points.map((p) => p.lon)),
    maxLon: Math.max(...points.map((p) => p.lon)),
  };
}

// --- DOM-render-functies -----------------------------------------------------

export function renderLegend(el) {
  el.innerHTML = CONFIG.levels
    .map((l) => `<span><i class="sw" style="background:var(${l.colorVar})"></i>${l.label}</span>`)
    .join("");
}

export function renderNow(els, { dew, margin, minSupply }) {
  const lvl = classify(dew);
  els.verdict.textContent = lvl.label;
  els.verdict.style.background = `var(${lvl.colorVar})`;
  els.dewpoint.textContent = `dauwpunt ${dew.toFixed(1)}°`;
  const x = recommendedSupply(dew, margin, minSupply);
  els.advice.textContent = `houd je aanvoer boven ${x.toFixed(1)}°`;
}

export function renderDayRanges(el, { hours, dewpoint, selIndex }) {
  const days = groupByDay(hours, dewpoint);
  const selDate = hours[selIndex].slice(0, 10);
  const fmt = (d) => new Date(d + "T12:00").toLocaleDateString("nl-NL", { weekday: "short" });
  const mid = (CONFIG.dewAxis.min + CONFIG.dewAxis.max) / 2;
  const ticks =
    `<div class="scale-ticks">` +
    `<span>${CONFIG.dewAxis.min}°</span><span>${mid}°</span><span>${CONFIG.dewAxis.max}°</span>` +
    `</div>`;
  const rows = days
    .map((d, i) => {
      const left = dewToScale(d.min) * 100;
      const right = dewToScale(d.max) * 100;
      const c1 = cssColor(classify(d.min).colorVar);
      const c2 = cssColor(classify(d.max).colorVar);
      const label = i === 0 ? "vandaag" : fmt(d.date);
      const isSel = d.date === selDate;
      const selDew = isSel ? dewpoint[selIndex] : null;
      const dot =
        selDew == null
          ? ""
          : `<div class="dot" style="left:${dewToScale(selDew) * 100}%;background:${cssColor(
              classify(selDew).colorVar,
            )}">${Math.round(selDew)}°</div>`;
      return `<div class="dayrow">
          <span class="lbl">${label}</span>
          <div class="track">
            <div class="bar" style="left:${left}%;width:${Math.max(
              2,
              right - left,
            )}%;background:linear-gradient(90deg,${c1},${c2})"></div>
            ${dot}
          </div></div>`;
    })
    .join("");
  el.innerHTML = ticks + rows;
}

export function renderHourChart(el, { hours, dewpoint, selIndex }) {
  const n = hours.length;
  const vals = dewpoint.map((v) => (v == null ? null : v));
  const present = vals.filter((v) => v != null);
  if (n < 2 || present.length === 0) {
    el.innerHTML = `<p class="muted">Te weinig data om een grafiek te tonen.</p>`;
    return;
  }
  const lo = Math.min(...present) - 1;
  const hi = Math.max(...present) + 1;
  const X = (i) => (i / (n - 1)) * 100;
  const Y = (v) => 100 - ((v - lo) / (hi - lo)) * 100;
  const pts = vals
    .map((v, i) => (v == null ? null : `${X(i)},${Y(v)}`))
    .filter(Boolean)
    .join(" ");
  const days = groupByDay(hours, dewpoint);
  const badges = days
    .map((d) => {
      // Kies het hoogste dauwpunt van de dag, null-waarden negerend.
      const valid = d.indices.filter((i) => dewpoint[i] != null);
      if (valid.length === 0) return "";
      const i = valid.reduce((a, b) => (dewpoint[b] > dewpoint[a] ? b : a), valid[0]);
      const c = cssColor(classify(dewpoint[i]).colorVar);
      return `<span class="maxbadge" style="left:${X(i)}%;top:${Y(
        dewpoint[i],
      )}%;background:${c}">${Math.round(dewpoint[i])}°</span>`;
    })
    .join("");
  el.innerHTML = `<div class="chart">
    ${badges}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Verwacht dauwpunt per uur over ${days.length} dagen">
      <polyline points="${pts}" fill="none" stroke="#222" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="scrub" style="left:${X(selIndex)}%"></div>
  </div>`;
}

export function renderMap(el, { places, selIndex, hourIndex, geo }) {
  const W = 200;
  const H = 230;
  // Vaste NL-bbox uit config: omtrek én stippen delen exact deze transformatie,
  // zodat de landgrens nooit buiten beeld valt (ook bij Zeeland/Wadden/Limburg).
  const proj = makeProjection(CONFIG.nlBbox, W, H, 8);
  const outline = geoToPaths(geo, proj);
  const dots = places
    .map((p, i) => {
      const { x, y } = proj(p);
      const lvl = classify(p.dewpoint[hourIndex]);
      const c = cssColor(lvl.colorVar);
      const sel = i === selIndex;
      // Toetsenbord-toegankelijk: focusbaar, role=button, label (niet alleen kleur).
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${sel ? 7 : 5}" fill="${c}" stroke="${
        sel ? "#222" : "#fff"
      }" stroke-width="${sel ? 2.5 : 1.5}" data-i="${i}" tabindex="0" role="button" aria-label="${
        p.name
      }: dauwpunt ${p.dewpoint[hourIndex]}°, ${lvl.label}"><title>${p.name}: dauwpunt ${
        p.dewpoint[hourIndex]
      }° — ${lvl.label}</title></circle>`;
    })
    .join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kaart van Nederland met dauwpunt per plaats">
    <path d="${outline}" fill="rgba(120,140,160,.14)" stroke="rgba(120,140,160,.5)" stroke-width="1"/>
    ${dots}
  </svg>`;
}

function geoToPaths(geo, proj) {
  // Ondersteunt FeatureCollection / Feature / (Multi)Polygon -> SVG path d.
  const polys = [];
  const pushGeom = (g) => {
    if (!g) return;
    if (g.type === "Polygon") polys.push(g.coordinates);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((c) => polys.push(c));
  };
  if (geo.type === "FeatureCollection") geo.features.forEach((f) => pushGeom(f.geometry));
  else if (geo.type === "Feature") pushGeom(geo.geometry);
  else pushGeom(geo);
  return polys
    .map((rings) =>
      rings
        .map(
          (ring) =>
            "M" +
            ring
              .map(([lon, lat]) => {
                const { x, y } = proj({ lat, lon });
                return `${x.toFixed(1)} ${y.toFixed(1)}`;
              })
              .join(" L") +
            "Z",
        )
        .join(" "),
    )
    .join(" ");
}
