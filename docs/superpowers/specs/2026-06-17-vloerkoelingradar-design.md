# Ontwerp: Vloerkoelingradar v1

_Datum: 2026-06-17 — status: vastgesteld na brainstorm_

## Doel

Een "buienradar voor vloerkoeling": laat per locatie zien of je de komende
~4 dagen veilig kunt koelen, op basis van de **dauwpunt**voorspelling uit het
KNMI-model. Het dauwpunt is de fysieke grens — kom je met je aanvoerwater onder
het dauwpunt, dan condenseert vocht op de vloer (nat, glad, schimmelrisico).

**Forecast-first**: het hoofdscherm is de persoonlijke forecast voor jouw plek.
Een landelijk kaartje onderaan geeft de "radar"-vibe.

## Kernbeslissingen (uit de brainstorm)

1. **Dauwpunt is het hoofdgetal en de basis voor de kleur.** Universeel, hangt
   niet af van ieders binnentemperatuur. (De eerdere ΔT-/binnentemperatuur-aanpak
   uit de README is bewust losgelaten.)
2. **Twee instellingen, bewaard in localStorage:** veiligheidsmarge (default
   2 °C) en minimale aanvoertemperatuur (default 16 °C). Deze bepalen alleen het
   **advies**getal, niet de kleur.
3. **Forecast-first**, met landelijk SVG-kaartje onderaan (buienradar-vibe).
4. **Volledig statisch**: Python-job (GitHub Actions, elke 6 u) berekent
   `forecast.json` voor; de browser leest alleen die JSON. Hosting op GitHub
   Pages. Geen live API/CORS, geen API-key.

## Het koel-model (client-side)

Per uur kennen we het voorspelde **dauwpunt** `Td` (en de temperatuur, voor
context).

- **Aanbevolen (koudst toegestane) aanvoertemperatuur** = `max(Td + marge, min_temp)`.
  Toon als _"houd je aanvoer boven X °C"_. Marge en `min_temp` instelbaar.
- **Kleur/oordeel op basis van het dauwpunt `Td`** (drempels voorlopig, eenvoudig
  te tunen — staan als constanten in de code):

  | Dauwpunt `Td` | Oordeel | Kleur |
  |---|---|---|
  | ≤ 14 °C | Volop koelen | 🟢 groen `#2f9e44` |
  | 14–16 °C | Gematigd | 🟡 geel `#f2c200` |
  | 16–18 °C | Beperkt | 🟠 oranje `#f08c00` |
  | ≥ 18 °C | Niet koelen | 🔴 rood `#e03131` |

  Onderbouwing: met de default-marge van 2 °C komt dauwpunt 18 °C overeen met een
  aanbevolen aanvoer van 20 °C — de praktijkgrens die de gebruiker zelf aanhoudt.
  Bronnen bevestigen een veiligheidsmarge van 2–3 °C en een praktische
  ondergrens van 16–18 °C voor vloerkoeling.

## Architectuur

Twee losse delen, gekoppeld via één JSON-bestand:

```
[GitHub Actions cron, elke 6u]
   scripts/fetch_forecast.py  --(Open-Meteo KNMI)-->  data/forecast.json  --(commit)-->
[GitHub Pages]  web/  <-- leest data/forecast.json in de browser
```

### Component 1 — Data-job (Python)

- `scripts/places.py` — vaste lijst van ~90 NL-plaatsen (naam, provincie, lat,
  lon), gespreid over alle 12 provincies. Eén bron van waarheid voor de
  forecast-punten.
- `scripts/fetch_forecast.py` —
  - Haalt per locatie (gebatcht: Open-Meteo accepteert komma-gescheiden
    lat/lon-lijsten) uurlijkse `temperature_2m` + `dew_point_2m` op, ~4 dagen,
    `timezone=Europe/Amsterdam`, model `knmi_seamless`.
  - Schrijft `data/forecast.json`. Doel: zo compact mogelijk.
  - Alleen ruwe grootheden opslaan (dauwpunt + temp). **Kleur/oordeel rekent de
    client** zodat de marge/min-temp-instellingen live werken.
  - Afronden op 1 decimaal; uurtijden 1× centraal opslaan (niet per plaats).
  - Houdt het op stdlib waar mogelijk (`urllib`), minimale dependencies.

`forecast.json` (vorm):

```json
{
  "generated_at": "2026-06-17T14:00:00+02:00",
  "model": "knmi_seamless",
  "hours": ["2026-06-17T00:00", "..."],
  "places": [
    { "name": "Gouda", "prov": "ZH", "lat": 52.01, "lon": 4.71,
      "dewpoint": [12.3, 12.1, "..."], "temp": [16.0, 15.4, "..."] }
  ]
}
```

### Component 2 — Statische site (`web/`)

Vanilla HTML/CSS/JS, **geen build, geen framework, geen externe libraries**.

- `web/index.html`, `web/app.js`, `web/style.css`.
- `web/places-search.json` — grotere lijst NL-plaatsen (naam + lat/lon) voor de
  zoekfunctie; los van de ~90 forecast-punten. Geen runtime-geocoding.
- `web/nl.geo.json` — vereenvoudigde NL-(provincie)grens voor het kaartje.
- Geen chart-library: de uurgrafiek en het kaartje zijn handgemaakte SVG.

Modules in `app.js` (kleine, geïsoleerde eenheden):

- **data** — laadt `forecast.json` (met cache-busting op `generated_at`).
- **model** — dauwpunt → kleur/oordeel; aanbevolen aanvoer = `max(Td+marge, min_temp)`.
- **location** — zoeken, geolocatie, klik-op-stip; haversine naar dichtstbijzijnde
  forecast-punt; lees/schrijf gekozen plek + instellingen in `localStorage`.
- **timeline** — geselecteerd uur, afspeelknop (animatie), deelt state met alle views.
- **views** — rendert: nu-oordeel, dag-ranges (A), uurgrafiek (B), kaartje,
  instellingen.

## UI (één pagina, van boven naar beneden)

1. **Locatiekop** — gekozen plaats, knoppen: zoeken, "Gebruik mijn locatie"
   (`navigator.geolocation`; vereist HTTPS — Pages levert dat).
2. **Nu-oordeel** — gekleurde badge ("Beperkt koelen"), dauwpunt nu, en
   _"houd je aanvoer boven X °C"_.
3. **Komende dagen — dag-ranges (A)** — per dag een balk van laagste → hoogste
   dauwpunt op een gedeelde dauwpunt-schaal (tick-labels 8/12/16/20°, géén losse
   gekleurde schaalbalk). Een bolletje markeert het geselecteerde uur. Balk
   ingekleurd met de zone-gradient.
4. **Exacte voorspelling — uurgrafiek (B)** — dauwpuntlijn per uur over ~4 dagen
   op een **neutrale** achtergrond (alleen dunne hulplijnen, géén gekleurde
   zones). Per dag een **gekleurde badge met het hoogste dauwpunt van die dag**
   (alleen het getal, zonder het woord "max"). Verticale scrub-lijn voor het
   geselecteerde uur.
5. **Tijdslider + afspeelknop** — scrubt het geselecteerde uur; A, B én het
   kaartje bewegen mee (de "radar"-animatie).
6. **Landelijk kaartje** — zelf-bevattend SVG (NL-grens uit `nl.geo.json`),
   gekleurde stip per forecast-punt op het geselecteerde uur, jouw plek omrand.
   Klik een stip → die plek wordt geselecteerd. Deelt de tijdslider.
7. **Instellingen** — schuif/invoer voor marge en minimale aanvoertemperatuur;
   bewaard in `localStorage`.
8. **Disclaimer** — tekst uit de README (model met onzekerheid; lokale
   condensbeveiliging blijft leidend).

## Deployment

- `.github/workflows/forecast.yml`:
  - **cron elke 6 uur** (+ handmatige trigger): draait `fetch_forecast.py`,
    commit een gewijzigde `data/forecast.json`.
  - Deployt de statische site (`web/` + `data/`) naar **GitHub Pages**.

## Aanpasbaarheid (expliciet ontwerpdoel)

Het ontwerp moet makkelijk aan te passen zijn zonder de code te moeten
doorgronden. Concreet:

- **Eén configuratie-bestand** `web/config.js` met alle "knoppen" op één plek:
  - kleurdrempels (de 14/16/18-grenzen) als een lijst van
    `{ tot, kleur, label }`-objecten — een niveau toevoegen/verschuiven is een
    regel data, geen logica;
  - default-marge en default-min-temp;
  - aantal voorspeldagen, het KNMI-model, refresh-frequentie-notitie;
  - schaal-grenzen van de dauwpunt-as (nu 8–20°).
  De `model`-module leest deze drempels; nergens anders staan magische getallen.
- **CSS custom properties (design-tokens)** bovenin `web/style.css`: kleuren
  (incl. de vier zone-kleuren), radii, spacing, fonts. De look omgooien =
  tokens aanpassen, geen selectors najagen.
- **Zone-kleuren staan één keer** (als CSS-variabelen) en worden door zowel de
  badges, dag-ranges, het kaartje als de legenda gebruikt — wijzig op één plek.
- **Plaatsenlijsten zijn pure data** (`scripts/places.py`, `web/places-search.json`):
  punten toevoegen/verwijderen zonder codewijziging.
- **Geen build-stap.** Bestand opslaan → pagina verversen. Lage drempel om te
  experimenteren.
- **Kleine, geïsoleerde modules** met heldere grenzen (data / model / location /
  timeline / views), zodat een view of de drempel-logica los aanpasbaar is.

## Niet in v1 (bewust, YAGNI)

- Geen interpolatie/heatmap tussen meetpunten (alleen stippen).
- Geen binnentemperatuur-instelling (model is universeel op dauwpunt).
- Geen inzoombare tile-kaart (Leaflet) — alleen het lichte SVG-kaartje.

## Foutafhandeling

- **Data-job:** als een batch-call faalt, retry met backoff; faalt het alsnog,
  behoud de vorige `forecast.json` (geen lege/half-bestand committen).
- **Client:** geen/oude `forecast.json` → toon nette melding + tijd van laatste
  update (`generated_at`). Geolocatie geweigerd → val terug op zoeken. Onbekende
  plek in localStorage → val terug op een default-plek.

## Aannames

- KNMI-model via Open-Meteo blijft sleutelloos en zonder CORS-issue voor de job
  (de browser raakt het nooit aan — alleen de Python-job).
- ~90 punten + ~4 dagen uurdata blijft een compacte `forecast.json` (richtlijn
  < ~300 kB ongecomprimeerd; Pages levert gzip).
- Drempels 14/16/18 zijn een verdedigbaar startpunt en eenvoudig te tunen.
