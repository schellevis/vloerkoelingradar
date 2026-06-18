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
      <polyline points="${pts}" fill="none" stroke="${cssColor("--chart-line")}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="scrub" style="left:${X(selIndex)}%"></div>
  </div>`;
}

const MAP_W = 200;
const MAP_H = 230;

// SVG path-d voor één (Multi)Polygon-feature via de gedeelde projectie.
function featurePath(geom, proj) {
  const polys =
    geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
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

// Tekent de gemeentevlakken één keer (zonder kleur). paintMap kleurt ze daarna in.
// Vlakken zijn focusbaar (toetsenbord) en gekoppeld aan de data via data-code.
export function renderMapBase(el, geo) {
  const proj = makeProjection(CONFIG.nlBbox, MAP_W, MAP_H, 8);
  const features = geo.type === "FeatureCollection" ? geo.features : [geo];
  const emptyFill = cssColor("--map-empty");
  const stroke = cssColor("--map-stroke");
  const paths = features
    .map((f) => {
      const code = f.properties.statcode;
      const name = f.properties.statnaam;
      const d = featurePath(f.geometry, proj);
      return `<path d="${d}" data-code="${code}" data-name="${name}" tabindex="0" role="button" fill="${emptyFill}" stroke="${stroke}" stroke-width="0.4"><title>${name}</title></path>`;
    })
    .join("");
  el.innerHTML = `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Kaart van Nederland: dauwpunt per gemeente">${paths}</svg>`;
}

// Werkt alleen de fill/selectie van de bestaande vlakken bij (soepel scrubben).
export function paintMap(el, { byCode, hourIndex, selCode }) {
  let selected = null;
  const stroke = cssColor("--map-stroke");
  const selectedStroke = cssColor("--map-selected-stroke");
  el.querySelectorAll("path[data-code]").forEach((path) => {
    const place = byCode[path.dataset.code];
    if (!place) return;
    const dew = place.dewpoint[hourIndex];
    const lvl = classify(dew);
    path.setAttribute("fill", cssColor(lvl.colorVar));
    const sel = path.dataset.code === selCode;
    path.setAttribute("stroke", sel ? selectedStroke : stroke);
    path.setAttribute("stroke-width", sel ? "1.6" : "0.4");
    path.setAttribute("aria-label", `${place.name}: dauwpunt ${dew}°, ${lvl.label}`);
    const title = path.querySelector("title");
    if (title) title.textContent = `${place.name}: dauwpunt ${dew}° — ${lvl.label}`;
    if (sel) selected = path;
  });
  if (selected) selected.parentNode.appendChild(selected); // gekozen gemeente naar voren
}
