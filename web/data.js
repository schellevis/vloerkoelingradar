// web/data.js
import { CONFIG } from "./config.js";

export function isStale(generatedAt, nowMs, staleHours = CONFIG.staleHours) {
  const ageMs = nowMs - Date.parse(generatedAt);
  return ageMs > staleHours * 3600 * 1000;
}

export async function loadForecast(fetchFn = globalThis.fetch) {
  const url = `${CONFIG.dataUrl}?v=${Date.now()}`;
  const res = await fetchFn(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`forecast laden faalde: ${res.status}`);
  return res.json();
}

// Bewaakt de browser tegen corrupte/incomplete/oude JSON: gooit een Error die
// app.js opvangt om een nette melding te tonen i.p.v. te crashen tijdens renderen.
export function validateForecast(data) {
  if (!data || typeof data !== "object") throw new Error("forecast: geen object");
  if (!Array.isArray(data.hours) || data.hours.length < 2) {
    throw new Error("forecast: hours ontbreekt of te kort");
  }
  if (!Array.isArray(data.places) || data.places.length === 0) {
    throw new Error("forecast: geen places");
  }
  if (Number.isNaN(Date.parse(data.generated_at))) {
    throw new Error("forecast: generated_at onparsebaar");
  }
  if (data.summary != null && typeof data.summary !== "string") {
    throw new Error("forecast: summary moet tekst zijn");
  }
  const n = data.hours.length;
  for (const p of data.places) {
    for (const key of ["dewpoint", "temp"]) {
      const arr = p[key];
      if (!Array.isArray(arr) || arr.length !== n) {
        throw new Error(`forecast: ${p && p.name}.${key} lengte != ${n}`);
      }
      if (!arr.every((v) => typeof v === "number" && Number.isFinite(v))) {
        throw new Error(`forecast: ${p && p.name}.${key} bevat niet-finite waarde`);
      }
    }
  }
  return data;
}
