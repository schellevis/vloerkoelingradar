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

## Bestandskaart

```
scripts/
  build_places.py    # leidt centroïde + provincie (point-in-polygon) per gemeente af
  places.json        # gegenereerd: [{name,prov,code,lat,lon}] voor ~342 gemeenten
  provincie.geo.json # build-data: provinciegrenzen (voor de PIP-toewijzing)
  places.py          # laadt places.json -> PLACES
  forecast_build.py  # build_forecast(...) + validate(...) (pure); neemt 'code' mee
  fetch_forecast.py  # fetch_all() batching/retry + run() schrijft veilig weg
  summary.py         # optionele landelijke dauwpunt-indruk via GitHub Models (stdlib urllib)
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
  er een token is (Actions `GITHUB_TOKEN` + `models: read`); faalt de LLM-call dan
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
