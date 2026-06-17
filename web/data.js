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
