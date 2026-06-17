# Vloerkoelingradar v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een statische "buienradar voor vloerkoeling" die per locatie toont of je de komende ~4 dagen veilig kunt koelen, op basis van de KNMI-dauwpuntvoorspelling.

**Architecture:** Een Python-job (GitHub Actions, elke 6 u) haalt uurdata uit het KNMI-model via Open-Meteo en schrijft één compacte `data/forecast.json`. Een volledig statische site (`web/`, vanilla ESM, geen build) leest die JSON en rekent kleur/advies client-side. Hosting op GitHub Pages.

**Tech Stack:** Python 3 (stdlib `urllib`, `unittest`) voor de data-job; vanilla HTML/CSS/JavaScript (ES modules, handgemaakte SVG, geen libraries/build) voor de site; `node:test` voor JS-unittests; GitHub Actions + Pages.

## Global Constraints

- **Geen build-stap, geen frontend-framework, geen externe JS-libraries.** Alles vanilla ESM, bestand opslaan → verversen.
- **Geen runtime third-party Python-dependencies** in de data-job — alleen stdlib (`urllib`, `json`, `unittest`).
- **Client raakt Open-Meteo nooit aan** — alleen de Python-job; de browser leest uitsluitend `data/forecast.json`.
- **Tijd-labels** in `forecast.json` zijn lokale Europe/Amsterdam-wandklok-labels zonder offset (bv. `"2026-06-17T14:00"`); behandel ze als lokale tijd, nooit als UTC.
- **Alle tunables** (drempels, kleuren, defaults, schaal, model, dagen) staan in `web/config.js` (JS) en `scripts/places.py` (data) — nergens magische getallen verspreid.
- **Klassegrens hoort bij de gunstigere (groenere) zijde:** dauwpunt `14.0` → "volop", `16.0` → "gematigd", `18.0` → "beperkt". Implementeer als `dewpoint <= upTo`.
- **Zone-kleuren** staan één keer als CSS-variabelen: `--c-green:#2f9e44`, `--c-yellow:#f2c200`, `--c-orange:#f08c00`, `--c-red:#e03131`.
- **Defaults:** marge `2 °C`, minimale aanvoer `16 °C`, `forecastDays: 4`, `staleHours: 12`, dauwpunt-as `8–20 °C`, model `knmi_seamless`.
- **Commits:** eindig elke commit-message met de trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Werk op branch `vloerkoelingradar-v1`.

## File Structure

**Data-job (Python):**
- `scripts/places.py` — `PLACES`: lijst van ~90 NL-forecast-punten (pure data).
- `scripts/forecast_build.py` — pure functies: `build_forecast(...)`, `validate(...)`.
- `scripts/fetch_forecast.py` — orchestratie: batching, retry, schrijven; injecteerbare HTTP-fetcher.
- `tests/test_forecast_build.py`, `tests/test_fetch_forecast.py`, `tests/test_places.py`.

**Site (`web/`, ESM):**
- `web/config.js` — alle tunables.
- `web/model.js` — `classify`, `recommendedSupply`.
- `web/geo.js` — `haversineKm`, `nearestPoint`, `makeProjection`.
- `web/days.js` — `nearestHourIndex`, `groupByDay`.
- `web/data.js` — `loadForecast`, `isStale`.
- `web/store.js` — gekozen plek + instellingen in `localStorage`.
- `web/views.js` — render-functies (nu-oordeel, dag-ranges, uurgrafiek, kaart, instellingen).
- `web/app.js` — bootstrap + bedrading.
- `web/index.html`, `web/style.css` — skelet + design-tokens.
- `web/places-search.json` — zoeklijst plaatsen (los van forecast-punten).
- `web/nl.geo.json` — vereenvoudigde NL-grens.
- `web/test/*.test.mjs` — `node:test` unittests voor de pure modules.

**CI:** `.github/workflows/forecast.yml` (cron-data + deploy), `.github/workflows/deploy-web.yml` (push op `web/**`).

---

## Task 1: Forecast-punten (`scripts/places.py`)

**Files:**
- Create: `scripts/places.py`
- Test: `tests/test_places.py`

**Interfaces:**
- Produces: `PLACES: list[dict]` met keys `name: str`, `prov: str`, `lat: float`, `lon: float`. `prov` is een 2-letter provinciecode uit `{GR,FR,DR,OV,FL,GE,UT,NH,ZH,ZE,NB,LI}`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_places.py
import unittest
from scripts.places import PLACES

PROVS = {"GR","FR","DR","OV","FL","GE","UT","NH","ZH","ZE","NB","LI"}

class TestPlaces(unittest.TestCase):
    def test_count_and_shape(self):
        self.assertGreaterEqual(len(PLACES), 80)
        for p in PLACES:
            self.assertEqual({"name","prov","lat","lon"}, set(p))
            self.assertIsInstance(p["name"], str)
            self.assertIn(p["prov"], PROVS)
            self.assertTrue(50.5 <= p["lat"] <= 53.7, p)
            self.assertTrue(3.2 <= p["lon"] <= 7.3, p)

    def test_all_provinces_covered(self):
        self.assertEqual(PROVS, {p["prov"] for p in PLACES})

    def test_names_unique(self):
        names = [p["name"] for p in PLACES]
        self.assertEqual(len(names), len(set(names)))

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_places -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.places'`.

(Ensure `scripts/__init__.py` and `tests/__init__.py` exist — create empty ones if missing.)

- [ ] **Step 3: Write the places data**

Create `scripts/places.py` with `PLACES = [...]` containing **at least 6–8 plaatsen per provincie** (≈90 totaal), elk met een realistische `lat`/`lon`. Verspreid over alle 12 provincies. Voorbeeldfragment (vul aan tot ~90):

```python
# scripts/places.py
"""Vaste lijst NL forecast-punten voor de Vloerkoelingradar."""

PLACES = [
    {"name": "Groningen",   "prov": "GR", "lat": 53.219, "lon": 6.567},
    {"name": "Delfzijl",    "prov": "GR", "lat": 53.337, "lon": 6.926},
    {"name": "Leeuwarden",  "prov": "FR", "lat": 53.201, "lon": 5.808},
    {"name": "Drachten",    "prov": "FR", "lat": 53.112, "lon": 6.099},
    {"name": "Assen",       "prov": "DR", "lat": 52.995, "lon": 6.564},
    {"name": "Emmen",       "prov": "DR", "lat": 52.785, "lon": 6.897},
    {"name": "Zwolle",      "prov": "OV", "lat": 52.512, "lon": 6.094},
    {"name": "Enschede",    "prov": "OV", "lat": 52.221, "lon": 6.894},
    {"name": "Lelystad",    "prov": "FL", "lat": 52.518, "lon": 5.471},
    {"name": "Almere",      "prov": "FL", "lat": 52.350, "lon": 5.265},
    {"name": "Arnhem",      "prov": "GE", "lat": 51.985, "lon": 5.899},
    {"name": "Nijmegen",    "prov": "GE", "lat": 51.842, "lon": 5.853},
    {"name": "Utrecht",     "prov": "UT", "lat": 52.091, "lon": 5.122},
    {"name": "Amersfoort",  "prov": "UT", "lat": 52.156, "lon": 5.388},
    {"name": "Amsterdam",   "prov": "NH", "lat": 52.374, "lon": 4.890},
    {"name": "Haarlem",     "prov": "NH", "lat": 52.381, "lon": 4.637},
    {"name": "Den Haag",    "prov": "ZH", "lat": 52.078, "lon": 4.288},
    {"name": "Rotterdam",   "prov": "ZH", "lat": 51.922, "lon": 4.479},
    {"name": "Gouda",       "prov": "ZH", "lat": 52.012, "lon": 4.704},
    {"name": "Middelburg",  "prov": "ZE", "lat": 51.499, "lon": 3.611},
    {"name": "Vlissingen",  "prov": "ZE", "lat": 51.443, "lon": 3.573},
    {"name": "Eindhoven",   "prov": "NB", "lat": 51.441, "lon": 5.469},
    {"name": "Tilburg",     "prov": "NB", "lat": 51.560, "lon": 5.091},
    {"name": "Den Bosch",   "prov": "NB", "lat": 51.697, "lon": 5.304},
    {"name": "Maastricht",  "prov": "LI", "lat": 50.851, "lon": 5.691},
    {"name": "Venlo",       "prov": "LI", "lat": 51.370, "lon": 6.172},
    # … vul aan tot ~90, ≥6 per provincie, geografisch gespreid …
]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m unittest tests.test_places -v`
Expected: PASS (alle 3 tests). Als `test_count_and_shape`/`test_all_provinces_covered` faalt: voeg plaatsen toe tot ≥80 en alle 12 provincies gedekt zijn.

- [ ] **Step 5: Commit**

```bash
git add scripts/__init__.py tests/__init__.py scripts/places.py tests/test_places.py
git commit -m "feat: add NL forecast points list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Forecast bouwen & valideren (`scripts/forecast_build.py`)

**Files:**
- Create: `scripts/forecast_build.py`
- Test: `tests/test_forecast_build.py`

**Interfaces:**
- Consumes: `PLACES`-vorm uit Task 1.
- Produces:
  - `build_forecast(generated_at: str, model: str, places: list[dict], hourly_by_place: list[dict]) -> dict`
    waarbij `hourly_by_place[i]` de Open-Meteo `hourly`-dict is voor `places[i]`
    (`{"time": [...], "temperature_2m": [...], "dew_point_2m": [...]}`).
    Retourneert `{"generated_at","model","hours":[...],"places":[{"name","prov","lat","lon","dewpoint":[...],"temp":[...]}]}`.
    Tijden 1× centraal in `hours`; getallen afgerond op 1 decimaal.
  - `validate(forecast: dict) -> None` — raise `ValueError` bij ongelijke
    arraylengtes, lege data, of `None`/`NaN` in `dewpoint`/`temp`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_forecast_build.py
import math, unittest
from scripts.forecast_build import build_forecast, validate

PLACES = [{"name": "Gouda", "prov": "ZH", "lat": 52.012, "lon": 4.704}]
HOURLY = [{"time": ["2026-06-17T00:00", "2026-06-17T01:00"],
           "temperature_2m": [16.04, 15.36], "dew_point_2m": [12.31, 12.09]}]

class TestBuild(unittest.TestCase):
    def test_build_shape_and_rounding(self):
        fc = build_forecast("2026-06-17T14:00:00+02:00", "knmi_seamless", PLACES, HOURLY)
        self.assertEqual(fc["model"], "knmi_seamless")
        self.assertEqual(fc["hours"], ["2026-06-17T00:00", "2026-06-17T01:00"])
        p = fc["places"][0]
        self.assertEqual(p["name"], "Gouda")
        self.assertEqual(p["dewpoint"], [12.3, 12.1])
        self.assertEqual(p["temp"], [16.0, 15.4])
        self.assertNotIn("time", p)  # tijden niet per plaats herhaald

    def test_validate_ok(self):
        fc = build_forecast("t", "m", PLACES, HOURLY)
        validate(fc)  # geen exception

    def test_validate_length_mismatch(self):
        fc = build_forecast("t", "m", PLACES, HOURLY)
        fc["places"][0]["dewpoint"].pop()
        with self.assertRaises(ValueError):
            validate(fc)

    def test_validate_rejects_nan(self):
        bad = [{"time": ["2026-06-17T00:00"], "temperature_2m": [None],
                "dew_point_2m": [float("nan")]}]
        fc = build_forecast("t", "m", PLACES, bad)
        with self.assertRaises(ValueError):
            validate(fc)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_forecast_build -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.forecast_build'`.

- [ ] **Step 3: Write the implementation**

```python
# scripts/forecast_build.py
"""Pure functies om Open-Meteo-antwoorden om te zetten naar forecast.json."""
import math


def _round1(x):
    return round(float(x), 1)


def build_forecast(generated_at, model, places, hourly_by_place):
    if not hourly_by_place:
        raise ValueError("geen hourly-data")
    hours = list(hourly_by_place[0]["time"])
    out_places = []
    for place, hourly in zip(places, hourly_by_place):
        out_places.append({
            "name": place["name"],
            "prov": place["prov"],
            "lat": place["lat"],
            "lon": place["lon"],
            "dewpoint": [None if v is None else _round1(v) for v in hourly["dew_point_2m"]],
            "temp": [None if v is None else _round1(v) for v in hourly["temperature_2m"]],
        })
    return {"generated_at": generated_at, "model": model, "hours": hours, "places": out_places}


def validate(forecast):
    hours = forecast.get("hours")
    if not hours:
        raise ValueError("lege of ontbrekende hours")
    n = len(hours)
    if not forecast.get("places"):
        raise ValueError("geen places")
    for p in forecast["places"]:
        for key in ("dewpoint", "temp"):
            arr = p.get(key)
            if arr is None or len(arr) != n:
                raise ValueError(f"{p.get('name')}: {key} lengte != {n}")
            for v in arr:
                if v is None or (isinstance(v, float) and math.isnan(v)):
                    raise ValueError(f"{p.get('name')}: None/NaN in {key}")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m unittest tests.test_forecast_build -v`
Expected: PASS (alle 4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/forecast_build.py tests/test_forecast_build.py
git commit -m "feat: build and validate forecast.json structure

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Ophalen met batching & retry (`scripts/fetch_forecast.py`)

**Files:**
- Create: `scripts/fetch_forecast.py`
- Test: `tests/test_fetch_forecast.py`

**Interfaces:**
- Consumes: `PLACES` (Task 1), `build_forecast`/`validate` (Task 2).
- Produces:
  - `fetch_all(places, fetch_json, batch_size=25, retries=3, sleep=lambda s: None) -> list[dict]`
    — splitst `places` in batches, roept `fetch_json(lats, lons)` aan (krijgt
    lijsten lat/lon terug-mapt naar per-plaats `hourly`-dicts), retry met backoff
    via `sleep`. Raise `RuntimeError` als een batch na alle retries faalt.
  - `run(out_path, *, fetch_json, now_iso, places=PLACES, model="knmi_seamless") -> dict`
    — bouwt + valideert + schrijft **alleen bij geldige, complete data**;
    schrijft nooit een half bestand. Retourneert het geschreven forecast-dict.
- `fetch_json(lats: list[float], lons: list[float]) -> list[dict]`: één Open-Meteo-call
  voor een batch, retourneert een lijst `hourly`-dicts (1 per locatie, in volgorde).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_fetch_forecast.py
import json, os, tempfile, unittest
from scripts.fetch_forecast import fetch_all, run

def make_hourly(seed):
    return {"time": ["2026-06-17T00:00", "2026-06-17T01:00"],
            "temperature_2m": [16.0 + seed, 15.0 + seed],
            "dew_point_2m": [12.0 + seed, 11.5 + seed]}

PLACES = [{"name": f"P{i}", "prov": "ZH", "lat": 52.0 + i/100, "lon": 4.0 + i/100}
          for i in range(3)]

class TestFetch(unittest.TestCase):
    def test_fetch_all_batches_and_orders(self):
        calls = []
        def fetch_json(lats, lons):
            calls.append(len(lats))
            return [make_hourly(i) for i in range(len(lats))]
        out = fetch_all(PLACES, fetch_json, batch_size=2)
        self.assertEqual(len(out), 3)
        self.assertEqual(calls, [2, 1])  # 2 batches: 2 + 1

    def test_fetch_all_retries_then_fails(self):
        def always_fail(lats, lons):
            raise OSError("boom")
        with self.assertRaises(RuntimeError):
            fetch_all(PLACES, always_fail, batch_size=3, retries=2)

    def test_run_writes_only_valid(self):
        def fetch_json(lats, lons):
            return [make_hourly(i) for i in range(len(lats))]
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "forecast.json")
            run(path, fetch_json=fetch_json, now_iso="2026-06-17T14:00:00+02:00", places=PLACES)
            data = json.load(open(path))
            self.assertEqual(len(data["places"]), 3)
            self.assertEqual(data["hours"], ["2026-06-17T00:00", "2026-06-17T01:00"])

    def test_run_keeps_existing_on_bad_data(self):
        def bad(lats, lons):
            return [{"time": ["2026-06-17T00:00"], "temperature_2m": [None],
                     "dew_point_2m": [None]} for _ in lats]
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "forecast.json")
            with open(path, "w") as f:
                f.write('{"keep":true}')
            with self.assertRaises(ValueError):
                run(path, fetch_json=bad, now_iso="t", places=PLACES)
            self.assertEqual(json.load(open(path)), {"keep": True})  # ongewijzigd

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_fetch_forecast -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.fetch_forecast'`.

- [ ] **Step 3: Write the implementation**

```python
# scripts/fetch_forecast.py
"""Haalt KNMI-uurdata op via Open-Meteo en schrijft data/forecast.json."""
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta

from scripts.places import PLACES
from scripts.forecast_build import build_forecast, validate

BASE = "https://api.open-meteo.com/v1/forecast"


def _chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def http_fetch_json(lats, lons, *, model="knmi_seamless", forecast_days=4):
    """Eén Open-Meteo-call voor een batch locaties -> lijst hourly-dicts."""
    params = {
        "latitude": ",".join(str(x) for x in lats),
        "longitude": ",".join(str(x) for x in lons),
        "hourly": "temperature_2m,dew_point_2m",
        "models": model,
        "forecast_days": str(forecast_days),
        "timezone": "Europe/Amsterdam",
    }
    url = f"{BASE}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = json.loads(resp.read().decode())
    # Open-Meteo: dict bij 1 locatie, list bij meerdere.
    items = data if isinstance(data, list) else [data]
    return [item["hourly"] for item in items]


def fetch_all(places, fetch_json, batch_size=25, retries=3, sleep=time.sleep):
    result = []
    for batch in _chunks(places, batch_size):
        lats = [p["lat"] for p in batch]
        lons = [p["lon"] for p in batch]
        last = None
        for attempt in range(retries):
            try:
                hourly = fetch_json(lats, lons)
                if len(hourly) != len(batch):
                    raise ValueError("batch lengte mismatch")
                result.extend(hourly)
                break
            except Exception as e:  # noqa: BLE001 - retry op elke fout
                last = e
                sleep(2 ** attempt)
        else:
            raise RuntimeError(f"batch faalde na {retries} pogingen: {last}")
    return result


def run(out_path, *, fetch_json, now_iso, places=PLACES, model="knmi_seamless"):
    hourly_by_place = fetch_all(places, fetch_json)
    forecast = build_forecast(now_iso, model, places, hourly_by_place)
    validate(forecast)  # raise vóór schrijven -> bestaand bestand blijft intact
    tmp = out_path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(forecast, f, separators=(",", ":"))
    import os
    os.replace(tmp, out_path)
    return forecast


def _now_amsterdam_iso():
    return datetime.now(timezone(timedelta(hours=2))).replace(microsecond=0).isoformat()


if __name__ == "__main__":
    run("data/forecast.json", fetch_json=http_fetch_json, now_iso=_now_amsterdam_iso())
    print("forecast.json geschreven")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m unittest tests.test_fetch_forecast -v`
Expected: PASS (alle 4 tests).

- [ ] **Step 5: Smoke-test tegen de echte API (handmatig, optioneel maar aanbevolen)**

Run: `python3 -m scripts.fetch_forecast && python3 -m unittest tests.test_forecast_build -v`
Expected: `data/forecast.json` bestaat, valide JSON, `places` ≈ aantal in `PLACES`.
Bij netwerkfout in deze omgeving: sla over, CI dekt dit.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch_forecast.py tests/test_fetch_forecast.py
git commit -m "feat: fetch forecast with batching, retry, and safe write

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: CI-workflows (data-cron + deploy)

**Files:**
- Create: `.github/workflows/forecast.yml`
- Create: `.github/workflows/deploy-web.yml`

**Interfaces:**
- Consumes: `scripts/fetch_forecast.py` (Task 3). Geen code-interface.

- [ ] **Step 1: Schrijf de data+deploy-workflow**

```yaml
# .github/workflows/forecast.yml
name: forecast
on:
  schedule:
    - cron: "0 */6 * * *"   # elke 6 uur
  workflow_dispatch: {}
permissions:
  contents: write
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Fetch forecast
        run: python -m scripts.fetch_forecast
      - name: Commit forecast if changed
        run: |
          if ! git diff --quiet -- data/forecast.json; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add data/forecast.json
            git commit -m "chore: update forecast.json [skip ci]"
            git push
          else
            echo "forecast.json ongewijzigd"
          fi
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - uses: actions/deploy-pages@v4
```

> Let op: **geen** `push`-trigger op `data/**` hier — de data-commit start de workflow niet opnieuw. De `[skip ci]` is extra vangnet.

- [ ] **Step 2: Schrijf de web-deploy-workflow**

```yaml
# .github/workflows/deploy-web.yml
name: deploy-web
on:
  push:
    branches: [main]
    paths: ["web/**", "data/**", ".github/workflows/deploy-web.yml"]
  workflow_dispatch: {}
permissions:
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Valideer de YAML lokaal**

Run: `python3 -c "import yaml" 2>/dev/null && python3 -c "import yaml,glob;[yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')];print('yaml ok')" || echo "pyyaml afwezig — sla over; GitHub valideert bij push"`
Expected: `yaml ok` of de overslaan-melding.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/forecast.yml .github/workflows/deploy-web.yml
git commit -m "ci: add forecast cron and Pages deploy workflows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend-config (`web/config.js`)

**Files:**
- Create: `web/config.js`
- Test: `web/test/config.test.mjs`

**Interfaces:**
- Produces: `export const CONFIG` met `model`, `forecastDays`, `dataUrl`, `staleHours`,
  `defaults:{margin,minSupply}`, `dewAxis:{min,max}`, en
  `levels: Array<{upTo:number,key:string,label:string,colorVar:string}>`
  (oplopend op `upTo`, laatste `upTo: Infinity`).

- [ ] **Step 1: Write the failing test**

```js
// web/test/config.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../config.js";

test("levels ascending and terminated by Infinity", () => {
  const ups = CONFIG.levels.map((l) => l.upTo);
  assert.deepEqual(ups, [...ups].sort((a, b) => a - b));
  assert.equal(CONFIG.levels.at(-1).upTo, Infinity);
});

test("defaults match spec", () => {
  assert.equal(CONFIG.defaults.margin, 2);
  assert.equal(CONFIG.defaults.minSupply, 16);
  assert.equal(CONFIG.staleHours, 12);
  assert.deepEqual(CONFIG.dewAxis, { min: 8, max: 20 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/test/config.test.mjs`
Expected: FAIL — kan `../config.js` niet vinden.

- [ ] **Step 3: Write the config**

```js
// web/config.js
export const CONFIG = {
  model: "knmi_seamless",
  forecastDays: 4,
  dataUrl: "../data/forecast.json",
  staleHours: 12,
  defaults: { margin: 2, minSupply: 16 },
  dewAxis: { min: 8, max: 20 }, // dauwpunt-schaal voor dag-ranges
  // Klassegrens hoort bij de groenere zijde: classify gebruikt dewpoint <= upTo.
  levels: [
    { upTo: 14, key: "volop", label: "Volop koelen", colorVar: "--c-green" },
    { upTo: 16, key: "gematigd", label: "Gematigd", colorVar: "--c-yellow" },
    { upTo: 18, key: "beperkt", label: "Beperkt", colorVar: "--c-orange" },
    { upTo: Infinity, key: "niet", label: "Niet koelen", colorVar: "--c-red" },
  ],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/test/config.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/config.js web/test/config.test.mjs
git commit -m "feat: add frontend config with tunable thresholds

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Koel-model (`web/model.js`)

**Files:**
- Create: `web/model.js`
- Test: `web/test/model.test.mjs`

**Interfaces:**
- Consumes: `CONFIG` (Task 5).
- Produces:
  - `classify(dewpoint: number) -> {key,label,colorVar,upTo}` — eerste level met `dewpoint <= upTo`.
  - `recommendedSupply(dewpoint: number, margin?: number, minSupply?: number) -> number`
    = `Math.max(dewpoint + margin, minSupply)`, default uit `CONFIG.defaults`.

- [ ] **Step 1: Write the failing test (boundaries expliciet)**

```js
// web/test/model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { classify, recommendedSupply } from "../model.js";

test("classify boundaries belong to greener side", () => {
  assert.equal(classify(13.9).key, "volop");
  assert.equal(classify(14.0).key, "volop");   // grens -> groener
  assert.equal(classify(14.1).key, "gematigd");
  assert.equal(classify(16.0).key, "gematigd");
  assert.equal(classify(16.1).key, "beperkt");
  assert.equal(classify(18.0).key, "beperkt");
  assert.equal(classify(18.1).key, "niet");
  assert.equal(classify(25).key, "niet");
});

test("recommendedSupply uses margin then clamps to minSupply", () => {
  assert.equal(recommendedSupply(17, 2, 16), 19); // 17+2
  assert.equal(recommendedSupply(10, 2, 16), 16); // clamp
  assert.equal(recommendedSupply(17), 19);        // defaults 2/16
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/test/model.test.mjs`
Expected: FAIL — `../model.js` ontbreekt.

- [ ] **Step 3: Write the implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/test/model.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/model.js web/test/model.test.mjs
git commit -m "feat: dewpoint classification and supply advice model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Geo — afstand, dichtstbijzijnde, projectie (`web/geo.js`)

**Files:**
- Create: `web/geo.js`
- Test: `web/test/geo.test.mjs`

**Interfaces:**
- Produces:
  - `haversineKm(a:{lat,lon}, b:{lat,lon}) -> number`
  - `nearestPoint(target:{lat,lon}, points:Array<{lat,lon}>) -> number` (index, -1 als leeg)
  - `makeProjection({minLat,maxLat,minLon,maxLon}, width, height, pad=0) -> (p:{lat,lon}) => {x,y}`
    — equirectangular met `cos(midLat)` x-correctie; y omgekeerd (noord = klein y).

- [ ] **Step 1: Write the failing test**

```js
// web/test/geo.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { haversineKm, nearestPoint, makeProjection } from "../geo.js";

test("haversine Amsterdam-Rotterdam ~ 57-58 km", () => {
  const d = haversineKm({ lat: 52.374, lon: 4.89 }, { lat: 51.922, lon: 4.479 });
  assert.ok(d > 50 && d < 65, `kreeg ${d}`);
});

test("nearestPoint picks closest index", () => {
  const pts = [{ lat: 53.2, lon: 6.5 }, { lat: 52.0, lon: 4.7 }, { lat: 50.85, lon: 5.69 }];
  assert.equal(nearestPoint({ lat: 52.09, lon: 5.12 }, pts), 1);
  assert.equal(nearestPoint({ lat: 0, lon: 0 }, []), -1);
});

test("projection maps corners within bounds, north is small y", () => {
  const proj = makeProjection({ minLat: 50.7, maxLat: 53.6, minLon: 3.3, maxLon: 7.2 }, 200, 230);
  const north = proj({ lat: 53.6, lon: 5 });
  const south = proj({ lat: 50.7, lon: 5 });
  assert.ok(north.y < south.y);
  assert.ok(north.y >= 0 && south.y <= 230);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/test/geo.test.mjs`
Expected: FAIL — `../geo.js` ontbreekt.

- [ ] **Step 3: Write the implementation**

```js
// web/geo.js
const R = 6371; // km
const rad = (d) => (d * Math.PI) / 180;

export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestPoint(target, points) {
  let best = -1;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = haversineKm(target, p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function makeProjection(bbox, width, height, pad = 0) {
  const { minLat, maxLat, minLon, maxLon } = bbox;
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos(rad(midLat));
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const w = width - 2 * pad;
  const h = height - 2 * pad;
  return ({ lat, lon }) => ({
    x: pad + ((lon - minLon) * kx) / spanX * w,
    y: pad + (maxLat - lat) / spanY * h, // noord boven
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/test/geo.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/geo.js web/test/geo.test.mjs
git commit -m "feat: geo helpers (haversine, nearest, projection)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Tijd-aggregatie (`web/days.js`)

**Files:**
- Create: `web/days.js`
- Test: `web/test/days.test.mjs`

**Interfaces:**
- Produces:
  - `nearestHourIndex(hours: string[], now: Date) -> number` — index van het uurlabel
    (lokaal geparsed via `new Date(label)`) dat het dichtst bij `now` ligt.
  - `groupByDay(hours: string[], dewpoint: number[]) -> Array<{date,indices,min,max}>`
    — groepeert op lokale kalenderdag (`label.slice(0,10)`); `min`/`max` over
    niet-`null` dauwpunten van die dag.

- [ ] **Step 1: Write the failing test**

```js
// web/test/days.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { nearestHourIndex, groupByDay } from "../days.js";

const HOURS = ["2026-06-17T00:00", "2026-06-17T13:00", "2026-06-17T14:00", "2026-06-18T00:00"];
const DEW = [12, 17, 16, 11];

test("nearestHourIndex rounds to closest label (local time)", () => {
  assert.equal(nearestHourIndex(HOURS, new Date("2026-06-17T13:40")), 2); // dichter bij 14:00
  assert.equal(nearestHourIndex(HOURS, new Date("2026-06-17T13:10")), 1);
});

test("groupByDay splits on calendar day with min/max", () => {
  const days = groupByDay(HOURS, DEW);
  assert.equal(days.length, 2);
  assert.deepEqual(days[0], { date: "2026-06-17", indices: [0, 1, 2], min: 12, max: 17 });
  assert.deepEqual(days[1], { date: "2026-06-18", indices: [3], min: 11, max: 11 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/test/days.test.mjs`
Expected: FAIL — `../days.js` ontbreekt.

- [ ] **Step 3: Write the implementation**

```js
// web/days.js
export function nearestHourIndex(hours, now) {
  const t = now.getTime();
  let best = 0;
  let bestD = Infinity;
  hours.forEach((h, i) => {
    const d = Math.abs(new Date(h).getTime() - t);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function groupByDay(hours, dewpoint) {
  const map = new Map();
  hours.forEach((h, i) => {
    const date = h.slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(i);
  });
  return [...map.entries()].map(([date, indices]) => {
    const vals = indices.map((i) => dewpoint[i]).filter((v) => v != null);
    return { date, indices, min: Math.min(...vals), max: Math.max(...vals) };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/test/days.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/days.js web/test/days.test.mjs
git commit -m "feat: hour-nearest and calendar-day aggregation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Data laden & stale-check (`web/data.js`)

**Files:**
- Create: `web/data.js`
- Test: `web/test/data.test.mjs`

**Interfaces:**
- Consumes: `CONFIG` (Task 5).
- Produces:
  - `isStale(generatedAt: string, nowMs: number, staleHours?: number) -> boolean`
  - `loadForecast(fetchFn=globalThis.fetch) -> Promise<object>` — `fetch(dataUrl?v=<ts>, {cache:"no-store"})`,
    throwt bij niet-OK; injecteerbare `fetchFn` voor tests.

- [ ] **Step 1: Write the failing test**

```js
// web/test/data.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { isStale, loadForecast } from "../data.js";

test("isStale true beyond staleHours", () => {
  const gen = "2026-06-17T00:00:00+02:00";
  const now = Date.parse("2026-06-17T11:00:00+02:00");
  assert.equal(isStale(gen, now, 12), false);
  assert.equal(isStale(gen, Date.parse("2026-06-17T13:00:00+02:00"), 12), true);
});

test("loadForecast uses no-store and returns json", async () => {
  let seenInit;
  const fakeFetch = async (url, init) => {
    seenInit = init;
    assert.ok(url.includes("?v="));
    return { ok: true, json: async () => ({ ok: 1 }) };
  };
  const data = await loadForecast(fakeFetch);
  assert.deepEqual(data, { ok: 1 });
  assert.equal(seenInit.cache, "no-store");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/test/data.test.mjs`
Expected: FAIL — `../data.js` ontbreekt.

- [ ] **Step 3: Write the implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/test/data.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/data.js web/test/data.test.mjs
git commit -m "feat: forecast loader with cache-busting and stale check

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Voorkeuren in localStorage (`web/store.js`)

**Files:**
- Create: `web/store.js`
- Test: `web/test/store.test.mjs`

**Interfaces:**
- Consumes: `CONFIG` (defaults).
- Produces:
  - `loadPrefs(storage=globalThis.localStorage) -> {placeName:string|null, margin:number, minSupply:number}`
    — valt terug op defaults bij ontbrekende/corrupte data.
  - `savePrefs(prefs, storage=globalThis.localStorage) -> void`

- [ ] **Step 1: Write the failing test**

```js
// web/test/store.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPrefs, savePrefs } from "../store.js";

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

test("defaults when empty", () => {
  const p = loadPrefs(memStorage());
  assert.equal(p.placeName, null);
  assert.equal(p.margin, 2);
  assert.equal(p.minSupply, 16);
});

test("round-trips saved prefs", () => {
  const s = memStorage();
  savePrefs({ placeName: "Gouda", margin: 3, minSupply: 17 }, s);
  assert.deepEqual(loadPrefs(s), { placeName: "Gouda", margin: 3, minSupply: 17 });
});

test("corrupt json falls back to defaults", () => {
  const s = memStorage();
  s.setItem("vkr.prefs", "{not json");
  assert.deepEqual(loadPrefs(s), { placeName: null, margin: 2, minSupply: 16 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/test/store.test.mjs`
Expected: FAIL — `../store.js` ontbreekt.

- [ ] **Step 3: Write the implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/test/store.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/store.js web/test/store.test.mjs
git commit -m "feat: localStorage preferences with safe defaults

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Statische assets — zoeklijst & NL-grens

**Files:**
- Create: `web/places-search.json`
- Create: `web/nl.geo.json`
- Create: `scripts/gen_search_list.py` (genereert `places-search.json` uit `PLACES` + extra)

**Interfaces:**
- Produces: `web/places-search.json` = `[{"name","lat","lon"}, ...]`;
  `web/nl.geo.json` = GeoJSON `FeatureCollection` (of een enkele MultiPolygon) van de NL-grens.

- [ ] **Step 1: Genereer de zoeklijst uit PLACES**

Schrijf `scripts/gen_search_list.py` dat `PLACES` (Task 1) inleest en `web/places-search.json` schrijft als `[{"name","lat","lon"}]`. Voor v1 mag de zoeklijst gelijk zijn aan de forecast-punten (uitbreiden kan later).

```python
# scripts/gen_search_list.py
import json
from scripts.places import PLACES

def main():
    out = [{"name": p["name"], "lat": p["lat"], "lon": p["lon"]} for p in PLACES]
    with open("web/places-search.json", "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__":
    main()
```

Run: `python3 -m scripts.gen_search_list && python3 -c "import json;print(len(json.load(open('web/places-search.json'))))"`
Expected: aantal == `len(PLACES)`.

- [ ] **Step 2: Voeg een vereenvoudigde NL-grens toe**

Haal een lichte NL-omtrek op als GeoJSON en bewaar als `web/nl.geo.json`. Bron-suggestie (publiek domein, low-res landgrens):

Run:
```bash
curl -sL "https://raw.githubusercontent.com/cartomap/nl/master/wgs84/country_simplified.geojson" -o web/nl.geo.json && python3 -c "import json;d=json.load(open('web/nl.geo.json'));print(d['type'])"
```
Expected: print `FeatureCollection` (of `Feature`). Lukt de download niet, gebruik een andere lichte NL-`country`/`provinces`-GeoJSON; voorwaarde: WGS84 lon/lat, < ~200 kB.

- [ ] **Step 3: Commit**

```bash
git add scripts/gen_search_list.py web/places-search.json web/nl.geo.json
git commit -m "feat: search list generator and NL boundary geojson

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: HTML-skelet & design-tokens (`web/index.html`, `web/style.css`)

**Files:**
- Create: `web/index.html`
- Create: `web/style.css`

**Interfaces:**
- Produces: DOM-anchors die `views.js`/`app.js` (Task 13–14) vullen, met exacte id's:
  `#location-name`, `#search`, `#geo-btn`, `#now-card`, `#now-verdict`, `#now-dewpoint`,
  `#now-advice`, `#day-ranges`, `#hour-chart`, `#timeline`, `#play-btn`, `#nl-map`,
  `#settings`, `#margin-input`, `#minsupply-input`, `#stale-banner`, `#legend`.

- [ ] **Step 1: Schrijf `web/style.css` met design-tokens bovenaan**

```css
/* web/style.css */
:root {
  --c-green: #2f9e44;
  --c-yellow: #f2c200;
  --c-orange: #f08c00;
  --c-red: #e03131;
  --bg: #fafafa;
  --card: #ffffff;
  --border: #e0e0e0;
  --text: #1d1d1f;
  --muted: #6b6b6b;
  --accent: #3a45a0;
  --radius: 12px;
  --space: 16px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); background: var(--bg); color: var(--text); }
main { max-width: 600px; margin: 0 auto; padding: var(--space); }
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space); margin-bottom: var(--space); }
.row { display: flex; gap: 8px; align-items: center; }
.muted { color: var(--muted); font-size: 13px; }
.verdict { display: inline-block; padding: 4px 12px; border-radius: 999px; color: #fff; font-weight: 700; }
button, input { font: inherit; }
button { cursor: pointer; border: 1px solid var(--border); background: var(--card); border-radius: 8px; padding: 8px 12px; }
button:focus-visible, input:focus-visible, [tabindex]:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
#stale-banner { background: #fff3bf; border: 1px solid #ffe066; padding: 8px 12px; border-radius: 8px; }
#stale-banner[hidden] { display: none; }
.legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12.5px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 13px; height: 13px; border-radius: 3px; display: inline-block; }
svg { display: block; width: 100%; height: auto; }
@media (max-width: 420px) { main { padding: 10px; } }
```

- [ ] **Step 2: Schrijf `web/index.html` met alle anchors**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vloerkoelingradar</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Vloerkoelingradar</h1>
    <div id="stale-banner" class="card" hidden></div>

    <section class="card">
      <div class="row">
        <strong id="location-name">…</strong>
        <span style="flex:1"></span>
        <button id="geo-btn" aria-label="Gebruik mijn locatie">📍 mijn locatie</button>
      </div>
      <div class="row" style="margin-top:8px">
        <input id="search" list="place-list" placeholder="Zoek je plaats…" aria-label="Zoek je plaats" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:8px" />
        <datalist id="place-list"></datalist>
      </div>
    </section>

    <section id="now-card" class="card">
      <div class="muted">Luchtvochtigheidssituatie</div>
      <div class="row" style="margin:6px 0">
        <span id="now-verdict" class="verdict">…</span>
        <span id="now-dewpoint" class="muted"></span>
      </div>
      <div class="muted">Jouw aanvoeradvies</div>
      <div id="now-advice"></div>
    </section>

    <section class="card">
      <div class="muted">Komende dagen — dauwpunt-range</div>
      <div id="day-ranges"></div>
    </section>

    <section class="card">
      <div class="muted">Exacte voorspelling — verwacht dauwpunt per uur</div>
      <div id="hour-chart"></div>
      <div class="row" style="margin-top:10px">
        <button id="play-btn" aria-label="Speel de dagen af">▶</button>
        <input id="timeline" type="range" min="0" max="0" value="0" step="1" style="flex:1" aria-label="Tijdstip" />
      </div>
      <div id="legend" class="legend" style="margin-top:8px"></div>
    </section>

    <section class="card">
      <div class="muted">Nederland — op het gekozen tijdstip</div>
      <div id="nl-map"></div>
    </section>

    <section id="settings" class="card">
      <div class="muted">Instellingen</div>
      <label class="row" style="margin-top:8px">Veiligheidsmarge (°C)
        <input id="margin-input" type="number" step="0.5" min="0" max="6" style="width:80px" />
      </label>
      <label class="row" style="margin-top:8px">Min. aanvoertemperatuur (°C)
        <input id="minsupply-input" type="number" step="0.5" min="10" max="22" style="width:80px" />
      </label>
    </section>

    <section class="card muted">
      <strong>Disclaimer.</strong> De koppeling buiten- → binnendauwpunt klopt het best bij
      een geventileerde woning; een lokale dauwpunt-/condensatiebeveiliging op de installatie
      blijft leidend. Voorspellingen zijn modelwaarden met onzekerheid — dit is een hulpmiddel,
      geen vervanging voor de regeling van de installateur.
    </section>
  </main>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verify it loads zonder console-fouten**

Run: `python3 -m http.server 8000 --directory web` (in achtergrond), open `http://localhost:8000/` met de Playwright-MCP-browser, neem een snapshot.
Expected: pagina rendert het skelet; `app.js` bestaat nog niet → 1 verwachte 404 op `app.js` (opgelost in Task 14). Geen andere fouten.

- [ ] **Step 4: Commit**

```bash
git add web/index.html web/style.css
git commit -m "feat: HTML skeleton and design tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Views — render-functies (`web/views.js`)

**Files:**
- Create: `web/views.js`
- Test: `web/test/views.test.mjs` (pure helpers; DOM-render handmatig geverifieerd in Task 14)

**Interfaces:**
- Consumes: `classify`, `recommendedSupply` (Task 6); `makeProjection` (Task 7); `groupByDay` (Task 8); `CONFIG` (Task 5).
- Produces (pure, getest):
  - `dewToScale(dew:number) -> number` — fractie 0..1 op de `CONFIG.dewAxis` (geclampt).
  - `bboxOf(points:Array<{lat,lon}>) -> {minLat,maxLat,minLon,maxLon}`
- Produces (DOM-render; nemen een container-element + state):
  - `renderNow(els, {dew, margin, minSupply})`
  - `renderDayRanges(el, {hours, dewpoint, selIndex})`
  - `renderHourChart(el, {hours, dewpoint, selIndex})`
  - `renderMap(el, {places, selIndex, hourIndex})`
  - `renderLegend(el)`
  Render-functies schrijven SVG/HTML via `innerHTML`/DOM en gebruiken `getComputedStyle`
  voor de zone-kleuren via `colorVar`.

- [ ] **Step 1: Write the failing test (pure helpers)**

```js
// web/test/views.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { dewToScale, bboxOf } from "../views.js";

test("dewToScale clamps to 0..1 over dewAxis 8..20", () => {
  assert.equal(dewToScale(8), 0);
  assert.equal(dewToScale(20), 1);
  assert.equal(dewToScale(14), 0.5);
  assert.equal(dewToScale(4), 0);
  assert.equal(dewToScale(30), 1);
});

test("bboxOf covers all points", () => {
  const b = bboxOf([{ lat: 51, lon: 4 }, { lat: 53, lon: 6 }]);
  assert.deepEqual(b, { minLat: 51, maxLat: 53, minLon: 4, maxLon: 6 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test web/test/views.test.mjs`
Expected: FAIL — `../views.js` ontbreekt.

- [ ] **Step 3: Write the implementation**

Volledige module met pure helpers + DOM-render. Kleuren komen uit CSS-variabelen zodat ze één bron hebben.

```js
// web/views.js
import { CONFIG } from "./config.js";
import { classify, recommendedSupply } from "./model.js";
import { makeProjection } from "./geo.js";
import { groupByDay } from "./days.js";

const cssColor = (varName) =>
  getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#888";

export function dewToScale(dew) {
  const { min, max } = CONFIG.dewAxis;
  return Math.max(0, Math.min(1, (dew - min) / (max - min)));
}

export function bboxOf(points) {
  return {
    minLat: Math.min(...points.map((p) => p.lat)),
    maxLat: Math.max(...points.map((p) => p.lat)),
    minLon: Math.min(...points.map((p) => p.lon)),
    maxLon: Math.max(...points.map((p) => p.lon)),
  };
}

export function renderLegend(el) {
  el.innerHTML = CONFIG.levels
    .map((l) => `<span><i class="sw" style="background:var(${l.colorVar})"></i>${l.label}</span>`)
    .join("");
}

export function renderNow(els, { dew, margin, minSupply }) {
  const lvl = classify(dew);
  els.verdict.textContent = lvl.label;
  els.verdict.style.background = `var(${lvl.colorVar})`;
  els.dewpoint.textContent = `dauwpunt ${dew.toFixed(1)}°`;
  const x = recommendedSupply(dew, margin, minSupply);
  els.advice.textContent = `houd je aanvoer boven ${x.toFixed(1)}°`;
}

export function renderDayRanges(el, { hours, dewpoint, selIndex }) {
  const days = groupByDay(hours, dewpoint);
  const selDate = hours[selIndex].slice(0, 10);
  const fmt = (d) => new Date(d + "T12:00").toLocaleDateString("nl-NL", { weekday: "short" });
  el.innerHTML =
    `<div style="display:flex;justify-content:space-between;margin:0 0 4px 64px;font-size:10.5px;color:var(--muted)">
       <span>${CONFIG.dewAxis.min}°</span><span>${(CONFIG.dewAxis.min + CONFIG.dewAxis.max) / 2}°</span><span>${CONFIG.dewAxis.max}°</span>
     </div>` +
    days
      .map((d, i) => {
        const left = dewToScale(d.min) * 100;
        const right = dewToScale(d.max) * 100;
        const c1 = cssColor(classify(d.min).colorVar);
        const c2 = cssColor(classify(d.max).colorVar);
        const label = i === 0 ? "vandaag" : fmt(d.date);
        const isSel = d.date === selDate;
        const selDew = isSel ? dewpoint[selIndex] : null;
        const dot =
          selDew == null
            ? ""
            : `<div style="position:absolute;top:-3px;left:${dewToScale(selDew) * 100}%;transform:translateX(-50%);width:22px;height:22px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3);background:${cssColor(classify(selDew).colorVar)};color:#fff;font-size:9.5px;display:flex;align-items:center;justify-content:center;font-weight:700">${Math.round(selDew)}°</div>`;
        return `<div style="display:flex;align-items:center;margin:7px 0">
          <span style="width:64px;font-size:13px;font-weight:600">${label}</span>
          <div style="position:relative;flex:1;height:16px;background:rgba(128,128,128,.10);border-radius:8px">
            <div style="position:absolute;left:${left}%;width:${Math.max(2, right - left)}%;height:16px;border-radius:8px;background:linear-gradient(90deg,${c1},${c2})"></div>
            ${dot}
          </div></div>`;
      })
      .join("");
}

export function renderHourChart(el, { hours, dewpoint, selIndex }) {
  const n = hours.length;
  const vals = dewpoint.map((v) => (v == null ? null : v));
  const lo = Math.min(...vals.filter((v) => v != null)) - 1;
  const hi = Math.max(...vals.filter((v) => v != null)) + 1;
  const X = (i) => (i / (n - 1)) * 100;
  const Y = (v) => 100 - ((v - lo) / (hi - lo)) * 100;
  const pts = vals
    .map((v, i) => (v == null ? null : `${X(i)},${Y(v)}`))
    .filter(Boolean)
    .join(" ");
  const days = groupByDay(hours, dewpoint);
  const badges = days
    .map((d) => {
      const i = d.indices.reduce((a, b) => (dewpoint[b] > dewpoint[a] ? b : a), d.indices[0]);
      const c = cssColor(classify(dewpoint[i]).colorVar);
      return `<span style="position:absolute;left:${X(i)}%;top:${Y(dewpoint[i])}%;transform:translate(-50%,-130%);background:${c};color:#fff;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;white-space:nowrap">${Math.round(dewpoint[i])}°</span>`;
    })
    .join("");
  el.innerHTML = `<div style="position:relative;height:160px;margin-left:30px;border-left:1px solid rgba(128,128,128,.4);border-bottom:1px solid rgba(128,128,128,.4)">
    ${badges}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Verwacht dauwpunt per uur over ${days.length} dagen">
      <polyline points="${pts}" fill="none" stroke="#222" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
    </svg>
    <div style="position:absolute;top:0;bottom:0;left:${X(selIndex)}%;border-left:2px solid var(--accent)"></div>
  </div>`;
}

export function renderMap(el, { places, selIndex, hourIndex, geo }) {
  const W = 200;
  const H = 230;
  const bbox = bboxOf(places);
  const proj = makeProjection(bbox, W, H, 8);
  const outline = geoToPaths(geo, proj);
  const dots = places
    .map((p, i) => {
      const { x, y } = proj(p);
      const c = cssColor(classify(p.dewpoint[hourIndex]).colorVar);
      const sel = i === selIndex;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${sel ? 7 : 5}" fill="${c}" stroke="${sel ? "#222" : "#fff"}" stroke-width="${sel ? 2.5 : 1.5}" data-i="${i}"><title>${p.name}: dauwpunt ${p.dewpoint[hourIndex]}°</title></circle>`;
    })
    .join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kaart van Nederland met dauwpunt per plaats">
    <path d="${outline}" fill="rgba(120,140,160,.14)" stroke="rgba(120,140,160,.5)" stroke-width="1"/>
    ${dots}
  </svg>`;
}

function geoToPaths(geo, proj) {
  // Ondersteunt FeatureCollection / Feature / (Multi)Polygon -> SVG path d.
  const polys = [];
  const pushGeom = (g) => {
    if (!g) return;
    if (g.type === "Polygon") polys.push(g.coordinates);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((c) => polys.push(c));
  };
  if (geo.type === "FeatureCollection") geo.features.forEach((f) => pushGeom(f.geometry));
  else if (geo.type === "Feature") pushGeom(geo.geometry);
  else pushGeom(geo);
  return polys
    .map((rings) =>
      rings
        .map(
          (ring) =>
            "M" +
            ring
              .map(([lon, lat]) => {
                const { x, y } = proj({ lat, lon });
                return `${x.toFixed(1)} ${y.toFixed(1)}`;
              })
              .join(" L") +
            "Z",
        )
        .join(" "),
    )
    .join(" ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test web/test/views.test.mjs`
Expected: PASS (pure helpers). DOM-render-functies worden end-to-end geverifieerd in Task 14.

- [ ] **Step 5: Commit**

```bash
git add web/views.js web/test/views.test.mjs
git commit -m "feat: render functions for verdict, ranges, chart, and map

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Bedrading & end-to-end verificatie (`web/app.js`)

**Files:**
- Create: `web/app.js`

**Interfaces:**
- Consumes: alle modules Task 5–13. Geen verdere producer-interface (entry point).

- [ ] **Step 1: Schrijf de bootstrap**

```js
// web/app.js
import { loadForecast, isStale } from "./data.js";
import { loadPrefs, savePrefs } from "./store.js";
import { nearestHourIndex } from "./days.js";
import { nearestPoint } from "./geo.js";
import {
  renderNow, renderDayRanges, renderHourChart, renderMap, renderLegend,
} from "./views.js";

const $ = (id) => document.getElementById(id);
const els = {
  verdict: $("now-verdict"), dewpoint: $("now-dewpoint"), advice: $("now-advice"),
};

const state = {
  forecast: null, geo: null, places: [], selIndex: 0, hourIndex: 0,
  prefs: loadPrefs(), playing: null,
};

function findPlaceIndex(name) {
  return state.places.findIndex((p) => p.name === name);
}

function renderAll() {
  const place = state.places[state.selIndex];
  const dew = place.dewpoint[state.hourIndex];
  $("location-name").textContent = place.name;
  renderNow(els, { dew, margin: state.prefs.margin, minSupply: state.prefs.minSupply });
  renderDayRanges($("day-ranges"), { hours: state.forecast.hours, dewpoint: place.dewpoint, selIndex: state.hourIndex });
  renderHourChart($("hour-chart"), { hours: state.forecast.hours, dewpoint: place.dewpoint, selIndex: state.hourIndex });
  renderMap($("nl-map"), { places: state.places, selIndex: state.selIndex, hourIndex: state.hourIndex, geo: state.geo });
}

function selectPlace(i) {
  if (i < 0) return;
  state.selIndex = i;
  state.prefs.placeName = state.places[i].name;
  savePrefs(state.prefs);
  renderAll();
}

function setHour(i) {
  state.hourIndex = Math.max(0, Math.min(state.forecast.hours.length - 1, i));
  $("timeline").value = String(state.hourIndex);
  renderAll();
}

function setupControls() {
  $("timeline").max = String(state.forecast.hours.length - 1);
  $("timeline").addEventListener("input", (e) => setHour(Number(e.target.value)));
  $("play-btn").addEventListener("click", togglePlay);
  $("search").addEventListener("change", (e) => {
    const i = findPlaceIndex(e.target.value);
    if (i >= 0) selectPlace(i);
  });
  $("place-list").innerHTML = state.places.map((p) => `<option value="${p.name}">`).join("");
  $("geo-btn").addEventListener("click", useGeolocation);
  const m = $("margin-input"), s = $("minsupply-input");
  m.value = state.prefs.margin; s.value = state.prefs.minSupply;
  m.addEventListener("change", () => { state.prefs.margin = Number(m.value); savePrefs(state.prefs); renderAll(); });
  s.addEventListener("change", () => { state.prefs.minSupply = Number(s.value); savePrefs(state.prefs); renderAll(); });
  $("nl-map").addEventListener("click", (e) => {
    const c = e.target.closest("circle[data-i]");
    if (c) selectPlace(Number(c.dataset.i));
  });
}

function togglePlay() {
  if (state.playing) { clearInterval(state.playing); state.playing = null; $("play-btn").textContent = "▶"; return; }
  $("play-btn").textContent = "⏸";
  state.playing = setInterval(() => {
    const next = (state.hourIndex + 1) % state.forecast.hours.length;
    setHour(next);
    if (next === 0) togglePlay();
  }, 250);
}

function useGeolocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const i = nearestPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude }, state.places);
    selectPlace(i);
  });
}

async function init() {
  try {
    state.forecast = await loadForecast();
    state.geo = await fetch("nl.geo.json").then((r) => r.json());
  } catch (e) {
    $("stale-banner").hidden = false;
    $("stale-banner").textContent = "Kon de voorspelling niet laden. Probeer later opnieuw.";
    return;
  }
  state.places = state.forecast.places;
  if (isStale(state.forecast.generated_at, Date.now())) {
    $("stale-banner").hidden = false;
    $("stale-banner").textContent = `Let op: data is van ${new Date(state.forecast.generated_at).toLocaleString("nl-NL")} en mogelijk verouderd.`;
  }
  state.hourIndex = nearestHourIndex(state.forecast.hours, new Date());
  const saved = state.prefs.placeName ? findPlaceIndex(state.prefs.placeName) : -1;
  state.selIndex = saved >= 0 ? saved : 0;
  renderLegend($("legend"));
  setupControls();
  setHour(state.hourIndex);
}

init();
```

- [ ] **Step 2: Genereer testdata voor lokale verificatie**

Als er nog geen echte `data/forecast.json` is (netwerk in CI/lokale omgeving), genereer een kleine fixture met een paar plaatsen en ~96 uur, zodat de UI te verifiëren is:

Run: `python3 -m scripts.fetch_forecast || echo "geen netwerk — maak fixture handmatig"`
(Indien geen netwerk: schrijf tijdelijk een `data/forecast.json` met 3–5 plaatsen en 24–96 synthetische uren in het juiste schema, alleen voor lokale verificatie.)

- [ ] **Step 3: End-to-end verificatie in de browser (Playwright MCP)**

Run: `python3 -m http.server 8000 --directory web` in de achtergrond.
Navigeer met de Playwright-MCP-browser naar `http://localhost:8000/`.
Verifieer via snapshot/screenshot:
- locatienaam, nu-oordeel (gekleurde badge), dauwpunt en "houd je aanvoer boven X°" verschijnen;
- dag-ranges tonen gekleurde balken met een bolletje op het geselecteerde uur;
- de uurgrafiek toont de lijn + gekleurde dag-badges + scrub-lijn;
- het kaartje toont de NL-omtrek met gekleurde stippen, gekozen plek omrand;
- slider verschuiven verandert grafiek/kaart/oordeel; ▶ animeert; klik op een stip selecteert die plek;
- marge/min-temp wijzigen verandert alleen de adviesregel, niet de kleur;
- **console bevat geen fouten**.

- [ ] **Step 4: Controleer de hele testsuite**

Run: `node --test web/test/*.test.mjs && python3 -m unittest discover -s tests -v`
Expected: alle JS- en Python-tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app.js
git commit -m "feat: wire up app bootstrap and interactions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Repo-documentatie & afronding

**Files:**
- Modify: `README.md` (voeg een korte "Hoe draait het / lokaal ontwikkelen"-sectie toe onder het bestaande concept)
- Modify: `main.py` (verwijderen of vervangen door een hint naar `scripts/fetch_forecast.py`)

**Interfaces:** geen.

- [ ] **Step 1: Documenteer build/run**

Voeg onderaan `README.md` toe: hoe de data-job draait (`python3 -m scripts.fetch_forecast`), hoe je lokaal serveert (`python3 -m http.server 8000 --directory web`), hoe je tests draait (`node --test web/test/*.test.mjs` en `python3 -m unittest discover -s tests`), en dat de Pages-URL door de workflow wordt gedeployed.

- [ ] **Step 2: Ruim `main.py` op**

Vervang de placeholder `main.py` door een korte verwijzing, of verwijder het en werk `pyproject.toml` bij als er een `[project.scripts]` naar verwees. (Er is geen entry-point die erop leunt.)

- [ ] **Step 3: Volledige testsuite + commit**

Run: `node --test web/test/*.test.mjs && python3 -m unittest discover -s tests`
Expected: alles PASS.

```bash
git add README.md main.py pyproject.toml
git commit -m "docs: document run/build/test workflow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push de branch en open een PR (alleen als de gebruiker dat wil)**

```bash
git push -u origin vloerkoelingradar-v1
gh pr create --fill --base main
```

---

## Self-Review (uitgevoerd bij het schrijven)

- **Spec-dekking:** data-job (T1–T3) ✓, CI met self-trigger-vermijding + commit-only-if-changed (T4) ✓, config-driven thresholds (T5) ✓, dauwpunt-model + grenzen (T6) ✓, nearest/projectie (T7) ✓, kalenderdag-ranges + nearest-hour (T8) ✓, cache-busting + stale (T9) ✓, localStorage-voorkeuren (T10) ✓, zoeklijst + NL-grens (T11) ✓, gelaagd nu-oordeel (humidity vs advies), dag-ranges (A), neutrale uurgrafiek met dag-badges (B), kaart, instellingen, disclaimer (T12–T14) ✓, a11y (focus, aria, niet-alleen-kleur, responsive) (T12/T14) ✓, acceptatiecriteria gedekt door validate() + isStale + boundary-tests ✓.
- **Geen placeholders:** elke code-stap bevat volledige code en exacte commando's.
- **Type-consistentie:** `classify`/`recommendedSupply`/`makeProjection`/`groupByDay`/`nearestHourIndex`/`loadForecast`/`isStale`/`loadPrefs`/`savePrefs` consistent gebruikt tussen tasks; DOM-id's in T12 matchen `app.js` in T14.
