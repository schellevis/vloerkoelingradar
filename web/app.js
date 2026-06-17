// web/app.js
import { CONFIG } from "./config.js";
import { loadForecast, isStale, validateForecast } from "./data.js";
import { loadPrefs, savePrefs } from "./store.js";
import { nearestHourIndex, wallClockMs, amsterdamNowLabel } from "./days.js";
import { nearestPoint } from "./geo.js";
import {
  renderNow, renderDayRanges, renderHourChart, renderMapBase, paintMap, renderLegend,
} from "./views.js";

const $ = (id) => document.getElementById(id);

function showBanner(msg) {
  const b = $("stale-banner");
  b.hidden = false;
  b.textContent = msg;
}

const clampLimit = (v, { min, max }) => Math.min(max, Math.max(min, v));
const els = {
  verdict: $("now-verdict"), dewpoint: $("now-dewpoint"), advice: $("now-advice"),
};

const state = {
  forecast: null, geo: null, places: [], byCode: {}, selIndex: 0, hourIndex: 0,
  prefs: loadPrefs(), playing: null,
};

function findPlaceIndex(name) {
  return state.places.findIndex((p) => p.name === name);
}

function renderAll() {
  const place = state.places[state.selIndex];
  const dew = place.dewpoint[state.hourIndex];
  $("location-name").textContent = place.name;
  renderNow(els, { dew, margin: state.prefs.margin, minSupply: state.prefs.minSupply });
  renderDayRanges($("day-ranges"), { hours: state.forecast.hours, dewpoint: place.dewpoint, selIndex: state.hourIndex });
  renderHourChart($("hour-chart"), { hours: state.forecast.hours, dewpoint: place.dewpoint, selIndex: state.hourIndex });
  paintMap($("nl-map"), { byCode: state.byCode, hourIndex: state.hourIndex, selCode: place.code });
}

function selectPlace(i) {
  if (i < 0) return;
  state.selIndex = i;
  state.prefs.placeName = state.places[i].name;
  savePrefs(state.prefs);
  renderAll();
}

function setHour(i) {
  state.hourIndex = Math.max(0, Math.min(state.forecast.hours.length - 1, i));
  $("timeline").value = String(state.hourIndex);
  renderAll();
}

function setupControls() {
  $("timeline").max = String(state.forecast.hours.length - 1);
  $("timeline").addEventListener("input", (e) => setHour(Number(e.target.value)));
  $("play-btn").addEventListener("click", togglePlay);
  $("search").addEventListener("change", (e) => {
    const i = findPlaceIndex(e.target.value);
    if (i >= 0) selectPlace(i);
  });
  $("place-list").innerHTML = state.places.map((p) => `<option value="${p.name}">`).join("");
  $("geo-btn").addEventListener("click", useGeolocation);
  const m = $("margin-input"), s = $("minsupply-input");
  // Input-grenzen uit CONFIG (zelfde bron als de store-validatie).
  m.min = CONFIG.limits.margin.min; m.max = CONFIG.limits.margin.max; m.step = CONFIG.limits.margin.step;
  s.min = CONFIG.limits.minSupply.min; s.max = CONFIG.limits.minSupply.max; s.step = CONFIG.limits.minSupply.step;
  m.value = state.prefs.margin; s.value = state.prefs.minSupply;
  m.addEventListener("change", () => {
    const v = clampLimit(Number(m.value), CONFIG.limits.margin);
    m.value = state.prefs.margin = Number.isFinite(v) ? v : state.prefs.margin;
    savePrefs(state.prefs); renderAll();
  });
  s.addEventListener("change", () => {
    const v = clampLimit(Number(s.value), CONFIG.limits.minSupply);
    s.value = state.prefs.minSupply = Number.isFinite(v) ? v : state.prefs.minSupply;
    savePrefs(state.prefs); renderAll();
  });
  const pickFromMap = (target) => {
    const path = target.closest("path[data-code]");
    if (!path) return;
    const i = state.places.findIndex((p) => p.code === path.dataset.code);
    if (i >= 0) selectPlace(i);
  };
  $("nl-map").addEventListener("click", (e) => pickFromMap(e.target));
  $("nl-map").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    pickFromMap(e.target);
  });
}

function togglePlay() {
  if (state.playing) { clearInterval(state.playing); state.playing = null; $("play-btn").textContent = "▶"; return; }
  $("play-btn").textContent = "⏸";
  state.playing = setInterval(() => {
    const next = (state.hourIndex + 1) % state.forecast.hours.length;
    setHour(next);
    if (next === 0) togglePlay();
  }, 250);
}

function useGeolocation() {
  const fail = () => showBanner("Locatie niet beschikbaar; zoek je plaats handmatig.");
  if (!navigator.geolocation) { fail(); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const i = nearestPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude }, state.places);
      if (i < 0) { fail(); return; }
      selectPlace(i);
    },
    fail,
  );
}

async function init() {
  try {
    state.forecast = await loadForecast();
    validateForecast(state.forecast); // gooit bij corrupte/incomplete data
    state.geo = await fetch("gemeenten.geo.json").then((r) => r.json());
  } catch (e) {
    showBanner("Kon de voorspelling niet laden of de data is ongeldig. Probeer later opnieuw.");
    return;
  }
  state.places = state.forecast.places;
  state.byCode = Object.fromEntries(state.places.map((p) => [p.code, p]));
  if (isStale(state.forecast.generated_at, Date.now())) {
    showBanner(`Let op: data is van ${new Date(state.forecast.generated_at).toLocaleString("nl-NL")} en mogelijk verouderd.`);
  }
  state.hourIndex = nearestHourIndex(state.forecast.hours, wallClockMs(amsterdamNowLabel(new Date())));
  const saved = state.prefs.placeName ? findPlaceIndex(state.prefs.placeName) : -1;
  state.selIndex = saved >= 0 ? saved : 0;
  renderLegend($("legend"));
  renderMapBase($("nl-map"), state.geo); // vlakken één keer; paintMap kleurt ze
  setupControls();
  setHour(state.hourIndex);
}

init();
