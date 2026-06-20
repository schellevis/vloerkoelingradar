# AGENTS.md — Vloerkoelingradar

De volledige projectgids (architectuur, constraints, valkuilen) staat in
**[`CLAUDE.md`](./CLAUDE.md)** — lees die eerst. Dit bestand herhaalt alleen de
model-info zodat agents 'm snel vinden.

## LLM-model (landelijke indruk)

De optionele `summary` in `web/data/forecast.json` wordt gegenereerd via
**GitHub Models** (OpenAI-compatibel endpoint, stdlib `urllib`, in
`scripts/summary.py`). Alleen in de data-job, nooit in de browser.

- **Default model: `openai/gpt-4o-mini`** (`DEFAULT_MODEL` in `summary.py`).
  Low-tier: snel/goedkoop, ruim genoeg voor een paar zinnen duiding op kale
  dagcijfers.
- **Override zonder code-wijziging:** env-var **`GITHUB_MODELS_MODEL`** in de
  workflow (bijv. `openai/gpt-4o`). Token via Actions `GITHUB_TOKEN` +
  `permissions: models: read`.
- **Parameters:** `temperature: 0` (stabiele diffs), `max_tokens: 400`.
- **Rate limits** gelden per account/token, niet per repo. De cron doet ~4 calls
  per dag (elke 6 u), wat ruim onder zelfs de gratis limieten zit (low-tier
  ~150 req/dag; high-tier ~50 req/dag; een betaald Copilot-plan verhoogt dit).
  GitHub Models staat los van Copilot "premium requests". Exacte tabel:
  https://docs.github.com/en/github-models/prototyping-with-ai-models#rate-limits
- **Fail-safe:** bij elke fout geeft `generate_summary` `None` → forecast.json
  wordt zonder `summary` weggeschreven; de build breekt nooit.
