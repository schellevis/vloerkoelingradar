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
- **Default model: `grok-4.5`** (`DEFAULT_MODEL` in `summary.py`), met
  **`glm-5.2` als eenmalige fallback** als de primaire call faalt: beste
  NL-tekst in een live vergelijking, geen reasoning-overhead (~100 tokens,
  `finish_reason: "stop"`). Veel andere Go-modellen souperen `max_tokens` op
  aan verborgen reasoning en kappen de zichtbare tekst af (of lekken
  `<think>`-blokken); check bij een modelwissel eerst met een losse call.
- **`MAX_TOKENS = 1200`** in `summary.py`: ruime marge omdat
  reasoning-tokenverbruik niet stabiel is bij `temperature: 0` — grok-4.5
  heeft het niet nodig, een override via `OPENCODE_MODEL` mogelijk wel.
- **Custom User-Agent verplicht:** Cloudflare blokkeert urllib's default
  `Python-urllib/x.y`-header (error 1010); zonder eigen `User-Agent` faalt elke
  call met HTTP 403, stil opgevangen door de fail-safe.
- **Override zonder code-wijziging:** env-var **`OPENCODE_MODEL`** in de
  workflow. Key via Actions secret **`OPENCODE_API_KEY`**.
- **Parameters:** `temperature: 0` (stabiele diffs), `max_tokens: 1200`.
- **Kosten:** betaald maandabonnement; de cron doet ~4 calls/dag (elke 6 u),
  verwaarloosbaar binnen het abonnement.
- **Fail-safe:** als beide calls falen geeft `generate_summary` `None` →
  forecast.json wordt zonder `summary` weggeschreven; de build breekt nooit.
  De fouten staan wel op stderr in de Actions-log.
