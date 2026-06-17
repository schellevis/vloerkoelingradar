// web/model.js
import { CONFIG } from "./config.js";

export function classify(dewpoint) {
  return CONFIG.levels.find((l) => dewpoint <= l.upTo);
}

export function recommendedSupply(
  dewpoint,
  margin = CONFIG.defaults.margin,
  minSupply = CONFIG.defaults.minSupply,
) {
  return Math.max(dewpoint + margin, minSupply);
}
