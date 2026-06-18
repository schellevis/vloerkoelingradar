// web/store.js
import { CONFIG } from "./config.js";

const KEY = "vkr.prefs";

// Begrens een waarde binnen [min, max]; val terug op def bij niet-finite invoer.
function clamp(value, { min, max }, def) {
  if (!Number.isFinite(value)) return def;
  return Math.min(max, Math.max(min, value));
}

export function loadPrefs(storage = globalThis.localStorage) {
  const def = {
    placeName: null,
    margin: CONFIG.defaults.margin,
    minSupply: CONFIG.defaults.minSupply,
    viewDays: CONFIG.forecastDayDefault,
  };
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return def;
    const p = JSON.parse(raw);
    return {
      placeName: typeof p.placeName === "string" ? p.placeName : null,
      margin: clamp(p.margin, CONFIG.limits.margin, def.margin),
      minSupply: clamp(p.minSupply, CONFIG.limits.minSupply, def.minSupply),
      viewDays: CONFIG.forecastDayOptions.includes(p.viewDays) ? p.viewDays : def.viewDays,
    };
  } catch {
    return def;
  }
}

export function savePrefs(prefs, storage = globalThis.localStorage) {
  storage.setItem(KEY, JSON.stringify(prefs));
}
