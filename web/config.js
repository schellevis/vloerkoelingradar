// web/config.js
export const CONFIG = {
  model: "knmi_seamless",
  forecastDays: 14,
  forecastDayOptions: [4, 7, 14],
  forecastDayDefault: 4,
  dataUrl: "data/forecast.json", // relatief t.o.v. web/ (site-root)
  staleHours: 12,
  defaults: { margin: 2, minSupply: 16 },
  // Grenzen voor de instelbare waarden — één bron voor de UI-inputs én de
  // validatie van uit localStorage geladen voorkeuren.
  limits: {
    margin: { min: 0, max: 6, step: 0.5 },
    minSupply: { min: 10, max: 22, step: 0.5 },
  },
  dewAxis: { min: 8, max: 20 }, // dauwpunt-schaal voor dag-ranges
  // Vaste NL-bounding-box voor de kaartprojectie (omtrek + stippen delen deze).
  nlBbox: { minLat: 50.7, maxLat: 53.6, minLon: 3.3, maxLon: 7.25 },
  // Klassegrens hoort bij de groenere zijde: classify gebruikt dewpoint <= upTo.
  levels: [
    { upTo: 14, key: "volop", label: "Volop koelen", colorVar: "--c-green" },
    { upTo: 16, key: "gematigd", label: "Gematigd", colorVar: "--c-yellow" },
    { upTo: 18, key: "beperkt", label: "Beperkt", colorVar: "--c-orange" },
    { upTo: Infinity, key: "niet", label: "Niet koelen", colorVar: "--c-red" },
  ],
};
