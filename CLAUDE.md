# CLAUDE.md — Vloerkoelingradar

Projectgids voor Claude Code. Lees dit eerst; het bespaart je het herontdekken
van de architectuur en de bewuste keuzes.

## Wat dit is

Een "buienradar voor vloerkoeling": een **volledig statische** webapp die per
locatie toont of je de komende ~4 dagen veilig kunt koelen, op basis van de
**dauwpunt**voorspelling uit het KNMI-model (via Open-Meteo).

Kern: zakt het aanvoerwater onder het dauwpunt, dan condenseert vocht op de
vloer. Het dauwpunt is dus de grens. De app is **forecast-first** (persoonlijke
forecast voor je eigen plek) met een landelijk kaartje als "radar"-overzicht.

## Architectuur (twee delen, gekoppeld via één JSON)

1. **Data-job** — Python (`scripts/`), draait in GitHub Actions elke 6 u. Haalt
   uurlijkse temperatuur + dauwpunt op voor **alle ~342 gemeenten** (centroïde per
   gemeente) uit Open-Meteo (model `knmi_seamless`) en schrijft één compacte
   **`web/data/forecast.json`** met alleen ruwe waarden (incl. `code` = statcode).
2. **Browser** — vanilla ES modules in `web/`, **geen build, geen frameworks,
   geen libraries**. Leest alleen die JSON en rekent kleur/advies client-side.

De browser raakt Open-Meteo nooit aan — alleen de Python-job doet dat.

## Het model (client-side)

- **Kleur/oordeel = functie van het dauwpunt** (universeel, hangt niet af van
  instellingen). Drempels in `web/config.js`, grens hoort bij de groenere zijde
  (`dewpoint <= upTo`): ≤16 groen · 16–18 geel · 18–21 oranje · >21 rood.
- **Aanbevolen aanvoer = `max(dauwpunt + marge, minSupply)`**. Marge (default 2)
  en minSupply (default 16) zijn instelbaar (localStorage) en veranderen **alleen
  het advies, niet de kleur**.

## LLM-model (landelijke indruk)

De optionele `summary` wordt gegenereerd via **OpenCode Go** (OpenAI-compatibel
chat/completions-endpoint, stdlib `urllib`, in `scripts/summary.py`). Alleen in
de data-job, nooit in de browser. GitHub Models is uitgefaseerd; dit verving het
1-op-1 (zelfde functiesignatuur, alleen endpoint/model/token gewisseld).

- **Endpoint:** `https://opencode.ai/zen/go/v1/chat/completions` (`ENDPOINT` in
  `summary.py`) — hoort bij het betaalde Go-abonnement
  (https://opencode.ai/docs/go/), niet het pay-as-you-go Zen-endpoint.
- **Default model: `grok-4.5`** (`DEFAULT_MODEL` in `summary.py`). Gekozen na
  live vergelijking van de Go-modellen op de echte prompt: het schrijft het
  meest natuurlijke, feitelijk kloppende NL en heeft geen reasoning-overhead
  (~100 output-tokens, `finish_reason: "stop"`). De rest viel af: `mimo-v2.5`
  schreef stroef en hallucineerde soms, `glm-5.2`/`deepseek-v4-pro` verstoken
  700–1200 tokens aan verborgen reasoning (deepseek kapte daardoor af met lege
  content), `qwen3.7-max` negeert `max_tokens`, `minimax-m3` lekt zijn
  `<think>`-blok de zichtbare content in, en `kimi-k3` geeft HTTP 400 op dit
  OpenAI-compatibele endpoint. Verander het model niet zonder eerst met een
  losse curl-call te checken dat `finish_reason` `"stop"` is en `content` niet
  leeg/afgekapt is.
- **Reasoning-overhead is de valkuil bij modelkeuze.** Veel Go-modellen laten
  `reasoning_content` meetellen in `max_tokens`, en dat verbruik is **niet
  stabiel bij `temperature: 0`** (~200–550 tokens variatie bij identieke
  prompts). Daarom staat `MAX_TOKENS` in `summary.py` op **1200** — grok-4.5
  heeft dat zelf niet nodig, maar een override via `OPENCODE_MODEL` mogelijk
  wel. Te krap = samenvatting knipt af zonder foutmelding (de fail-safe vangt
  dat stil op als lege `content`, niet als exception).
- **Override zonder code-wijziging:** env-var **`OPENCODE_MODEL`** in de
  workflow. Token via Actions secret **`OPENCODE_API_KEY`** (Bearer-token, geen
  `permissions:` nodig — geen GitHub-eigen API meer).
- **Parameters:** `temperature: 0` (stabiele diffs), `max_tokens: 1200`
  (`MAX_TOKENS` in `summary.py` — zie hierboven waarom dit ruim zit).
- **User-Agent verplicht:** Cloudflare vóór `opencode.ai` blokkeert urllib's
  default `Python-urllib/x.y`-header (Cloudflare-error 1010,
  `browser_signature_banned`) — de request zet daarom altijd een eigen
  `User-Agent`. Zonder die header faalt elke call met HTTP 403, stil opgevangen
  door de fail-safe (dus zonder duidelijke foutmelding in de Actions-log).
- **Kosten:** betaald maandabonnement (Go), geen per-request rate-limit-tabel
  zoals GitHub Models. De cron doet ~4 calls/dag (elke 6 u) met hooguit een
  paar duizend tokens per call — verwaarloosbaar binnen het abonnement.
- **Fail-safe:** bij elke fout geeft `generate_summary` `None` → forecast.json
  wordt zonder `summary` weggeschreven; de build breekt nooit.

## Bestandskaart

```
scripts/
  build_places.py    # leidt centroïde + provincie (point-in-polygon) per gemeente af
  places.json        # gegenereerd: [{name,prov,code,lat,lon}] voor ~342 gemeenten
  provincie.geo.json # build-data: provinciegrenzen (voor de PIP-toewijzing)
  places.py          # laadt places.json -> PLACES
  forecast_build.py  # build_forecast(...) + validate(...) (pure); neemt 'code' mee
  fetch_forecast.py  # fetch_all() batching/retry + run() schrijft veilig weg
  summary.py         # optionele landelijke dauwpunt-indruk via OpenCode Go (stdlib urllib)
  gen_search_list.py # genereert web/places-search.json uit PLACES
web/
  config.js   # ALLE tunables: levels/drempels, defaults, limits, dewAxis, nlBbox, model
  model.js    # classify(dew), recommendedSupply(dew,margin,minSupply)
  geo.js      # haversineKm, nearestPoint, makeProjection (cos(lat)-correctie)
  days.js     # wallClockMs, amsterdamNowLabel, nearestHourIndex, groupByDay
  data.js     # loadForecast (no-store + ?v=), isStale, validateForecast
  store.js    # loadPrefs/savePrefs (localStorage, geclampt op CONFIG.limits)
  views.js    # dewToScale, bboxOf, render*: now/dayRanges/hourChart/legend +
              #   renderMapBase (tekent gemeentevlakken 1x) + paintMap (kleurt/scrubt)
  app.js      # bootstrap + bedrading van alle interacties
  gemeenten.geo.json # 342 gemeentegrenzen (WGS84), bron voor de choropleth
  index.html, style.css, places-search.json, package.json ({"type":"module"})
  test/*.test.mjs    # node:test unit-tests voor de pure modules
tests/               # unittest voor de Python-modules
.github/workflows/   # forecast.yml (cron+deploy), deploy-web.yml (push op web/**)
docs/superpowers/    # specs/ (ontwerp) en plans/ (implementatieplan)
```

## Commando's

```bash
python3 -m scripts.fetch_forecast        # data ophalen -> web/data/forecast.json
python3 -m http.server 8000 --directory web   # lokaal serveren (site-root = web/)
node --test web/test/*.test.mjs          # JS-tests
python3 -m unittest discover -s tests    # Python-tests
```

## Harde constraints (niet schenden)

- **Geen build-stap, geen frontend-framework, geen externe JS-libraries.** Vanilla
  ESM; bestand opslaan → verversen.
- **Geen third-party Python-deps** — alleen stdlib (`urllib`, `json`, `zoneinfo`,
  `unittest`).
- **Tunables horen in `web/config.js`**; kleuren als CSS-variabelen in `style.css`
  (één bron, gebruikt via `getComputedStyle`).
- **Model blijft universeel**: kleur op het dauwpunt; marge/minSupply enkel advies.
- Werk op een feature-branch; commit pas/push alleen op verzoek.

## Valkuilen / weet dit

- **Tijd is lokale Europe/Amsterdam-wandklok zonder offset** (bv.
  `"2026-06-17T14:00"`). Parse die NOOIT met `new Date(label)` (dat gebruikt de
  apparaat-zone). Gebruik `wallClockMs()` + `amsterdamNowLabel()` uit `days.js`.
  "Dag" in dag-ranges = lokale kalenderdag (`label.slice(0,10)`).
- **Datapad**: de job schrijft `web/data/forecast.json`; de client laadt de
  relatieve URL `data/forecast.json`; Pages uploadt `path: web`. Eén consistent
  model, werkt lokaal én bij deploy.
- **De kaart is een choropleth**: `renderMapBase` tekent de 342 gemeentevlakken
  één keer (uit `gemeenten.geo.json`), `paintMap` update bij elke scrub alléén de
  `fill` (en de selectie) — niet de hele SVG opnieuw, anders hapert de slider.
  Forecast↔polygon matchen op `code` (statcode). Projectie via de vaste
  `CONFIG.nlBbox`, zodat alle vlakken dezelfde transformatie delen.
- **`scripts/places.json` is gegenereerd** door `build_places.py` (centroïde +
  provincie via point-in-polygon). Bij een nieuwe gemeente-indeling: nieuwe
  `gemeenten.geo.json`/`provincie.geo.json` plaatsen en het script herdraaien.
- **Client vertrouwt de JSON niet blind**: `validateForecast()` gooit bij
  corrupte/incomplete data → `app.js` toont een banner i.p.v. te crashen.
- **`forecast.json` is gecommit** als startdataset; de cron commit 'm bij wijziging
  (met `[skip ci]`; de workflow heeft géén push-trigger op data om self-trigger te
  vermijden).
- **De landelijke indruk (`summary`) is optioneel.** De data-job vult 'm alleen als
  er een key is (Actions secret `OPENCODE_API_KEY`); faalt de LLM-call dan
  geeft `generate_summary` `None` en schrijven we forecast.json zonder veld. De
  client toont 'm via `renderSummary` (met `textContent`, niet `innerHTML`: modeltekst
  is minder vertrouwd dan de KNMI-cijfers) en `validateForecast` vereist 'm niet.
  Het model duidt alleen; kleur/advies blijven deterministisch uit het dauwpunt.
- `innerHTML` in `views.js` is bewust: data is trusted (eigen plaatslijst + KNMI),
  en een sanitizer is uitgesloten door de geen-libraries-constraint.

## Ontwerp & geschiedenis

- Ontwerpspec: `docs/superpowers/specs/2026-06-17-vloerkoelingradar-design.md`
- Implementatieplan: `docs/superpowers/plans/2026-06-17-vloerkoelingradar-v1.md`

De eerdere README-aanpak met ΔT/binnentemperatuur/5 niveaus/relatieve
vochtigheid is **bewust verlaten** ten gunste van het universele dauwpunt-model
hierboven — verwar de twee niet.
