# AGENTS.md — Vloerkoelingradar

De volledige projectgids (architectuur, constraints, valkuilen) staat in
**[`CLAUDE.md`](./CLAUDE.md)** — lees die eerst. Dit bestand herhaalt alleen de
model-info zodat agents 'm snel vinden.

## LLM-model (landelijke indruk)

De optionele `summary` in `web/data/forecast.json` wordt gegenereerd via
**OpenCode Go** (OpenAI-compatibel chat/completions-endpoint, stdlib `urllib`,
in `scripts/summary.py`). Alleen in de data-job, nooit in de browser.

- **Endpoint:** `https://opencode.ai/zen/go/v1/chat/completions` (Go-abonnement,
  niet het pay-as-you-go Zen-endpoint).
- **Default model: `mimo-v2.5`** (`DEFAULT_MODEL` in `summary.py`). Andere
  Go-modellen zijn reasoning-modellen die `max_tokens` opsouperen aan verborgen
  reasoning en de zichtbare tekst afkappen; `mimo-v2.5` levert het meest
  consistent complete NL-tekst.
- **`mimo-v2.5` redeneert zelf ook.** Reasoning-tokenverbruik is niet stabiel
  bij `temperature: 0` (~200–550 tokens gezien bij identieke prompts), vandaar
  `MAX_TOKENS = 1200` in `summary.py` i.p.v. een kráppe waarde.
- **Custom User-Agent verplicht:** Cloudflare blokkeert urllib's default
  `Python-urllib/x.y`-header (error 1010); zonder eigen `User-Agent` faalt elke
  call met HTTP 403, stil opgevangen door de fail-safe.
- **Override zonder code-wijziging:** env-var **`OPENCODE_MODEL`** in de
  workflow. Key via Actions secret **`OPENCODE_API_KEY`**.
- **Parameters:** `temperature: 0` (stabiele diffs), `max_tokens: 1200`.
- **Kosten:** betaald maandabonnement; de cron doet ~4 calls/dag (elke 6 u),
  verwaarloosbaar binnen het abonnement.
- **Fail-safe:** bij elke fout geeft `generate_summary` `None` → forecast.json
  wordt zonder `summary` weggeschreven; de build breekt nooit.
