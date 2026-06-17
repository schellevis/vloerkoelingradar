// web/store.js
import { CONFIG } from "./config.js";

const KEY = "vkr.prefs";

export function loadPrefs(storage = globalThis.localStorage) {
  const def = { placeName: null, margin: CONFIG.defaults.margin, minSupply: CONFIG.defaults.minSupply };
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return def;
    const p = JSON.parse(raw);
    return {
      placeName: typeof p.placeName === "string" ? p.placeName : null,
      margin: Number.isFinite(p.margin) ? p.margin : def.margin,
      minSupply: Number.isFinite(p.minSupply) ? p.minSupply : def.minSupply,
    };
  } catch {
    return def;
  }
}

export function savePrefs(prefs, storage = globalThis.localStorage) {
  storage.setItem(KEY, JSON.stringify(prefs));
}
