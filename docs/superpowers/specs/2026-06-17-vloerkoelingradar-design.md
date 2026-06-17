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
  te tunen — staan als configuratie in `web/config.js`):

  | Dauwpunt `Td` | Oordeel | Kleur |
  |---|---|---|
  | ≤ 14 °C | Volop koelen | 🟢 groen `#2f9e44` |
  | 14–16 °C | Gematigd | 🟡 geel `#f2c200` |
  | 16–18 °C | Beperkt | 🟠 oranje `#f08c00` |
  | ≥ 18 °C | Niet koelen | 🔴 rood `#e03131` |

  Onderbouwing: met de default-marge van 2 °C komt dauwpunt 18 °C overeen met een
  aanbevolen aanvoer van 20 °C — de praktijkgrens die de gebruiker zelf aanhoudt.
  Bronnen bevestigen een veiligheidsmarge van 2–3 °C en een praktische
  ondergrens van 16–18 °C voor vloerkoeling:
  - Benelux Vloerverwarming — min. aanvoer ~16–18 °C voor vloerkoeling:
    <https://beneluxvloerverwarming.com/koelen-met-vloerverwarming/>
  - Airco.One — dauwpunt/condensatie, condens al mogelijk bij 18–19 °C op warme,
    vochtige dagen:
    <https://airco.one/koelen-met-een-warmtepomp-belangrijke-aandachtspunten-voor-comfort-en-condensatie/>
  - Price Industries — veiligheidsmarge van ~2–3 °C tussen gekoeld oppervlak en
    dauwpunt:
    <https://blog.priceindustries.com/prevent-condensation-from-becoming-a-design-flaw>

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
  - Haalt uurlijkse `temperature_2m` + `dew_point_2m` op, ~4 dagen,
    `timezone=Europe/Amsterdam`, model `knmi_seamless`.
  - **Batching:** Open-Meteo accepteert komma-gescheiden lat/lon-lijsten; we
    batchen in groepen van **~25 locaties** per call. Per batch een **retry met
    backoff** (bv. 3 pogingen). Faalt een batch definitief of komt incomplete
    data terug → **behoud de bestaande `forecast.json`** en breek af met een
    duidelijke foutmelding (nooit een half/leeg bestand committen).
  - Schrijft `data/forecast.json`. Doel: zo compact mogelijk.
  - Alleen ruwe grootheden opslaan (dauwpunt + temp). **Kleur/oordeel rekent de
    client** zodat de marge/min-temp-instellingen live werken.
  - Afronden op 1 decimaal; uurtijden 1× centraal opslaan (niet per plaats).
  - **Tijd-labels:** `hours` bevat lokale Europe/Amsterdam-labels zonder offset
    (zoals Open-Meteo ze levert). De spec en de client behandelen ze expliciet
    als lokale wandklok-tijd, **niet** als UTC. DST-overgangen volgen het label
    van de bron (geen eigen herberekening).
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

- **data** — laadt `data/forecast.json` met `fetch(url, { cache: "no-store" })`
  plus een `?v=<timestamp>`-query als extra cache-buster (we kennen
  `generated_at` immers pas ná het laden). Toont daarna `generated_at` in de UI.
- **model** — dauwpunt → kleur/oordeel; aanbevolen aanvoer = `max(Td+marge, min_temp)`.
- **location** — zoeken, geolocatie, klik-op-stip; haversine naar dichtstbijzijnde
  forecast-punt; lees/schrijf gekozen plek + instellingen in `localStorage`.
- **timeline** — geselecteerd uur, afspeelknop (animatie), deelt state met alle views.
- **views** — rendert: nu-oordeel, dag-ranges (A), uurgrafiek (B), kaartje,
  instellingen.

## UI (één pagina, van boven naar beneden)

1. **Locatiekop** — gekozen plaats, knoppen: zoeken, "Gebruik mijn locatie"
   (`navigator.geolocation`; vereist HTTPS — Pages levert dat).
2. **Nu-oordeel** — twee duidelijk gescheiden lagen om verwarring te voorkomen
   (kleur hangt níet van je instellingen af, het advies wél):
   - **"Luchtvochtigheidssituatie"** — de gekleurde badge ("Beperkt koelen") +
     dauwpunt nu. Dit is de algemene dauwpuntklasse, los van instellingen.
   - **"Jouw aanvoeradvies"** — _"houd je aanvoer boven X °C"_, met
     `X = max(dauwpunt + marge, min_temp)`. Dit verandert mee met je instellingen.
   - **Definitie van "nu":** het forecast-uur dat het dichtst bij de huidige
     lokale tijd ligt (afronden op het dichtstbijzijnde hele uur).
3. **Komende dagen — dag-ranges (A)** — per dag een balk van laagste → hoogste
   dauwpunt op een gedeelde dauwpunt-schaal (tick-labels 8/12/16/20°, géén losse
   gekleurde schaalbalk). Een bolletje markeert het geselecteerde uur. Balk
   ingekleurd met de zone-gradient. **"Dag" = lokale kalenderdag** (Europe/
   Amsterdam, 00:00–23:59); min/max worden over alle uren van die kalenderdag
   bepaald.
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
   **Projectie:** één gedeelde lon/lat → SVG-transformatie (eenvoudige
   equirectangular fit op de NL-bounding-box, met lichte breedtegraad-correctie
   `cos(lat)` op de x-schaal). De NL-grens én de stippen gebruiken **exact
   dezelfde** transformatie, zodat punten op de juiste plek liggen.
7. **Instellingen** — schuif/invoer voor marge en minimale aanvoertemperatuur;
   bewaard in `localStorage`.
8. **Disclaimer** — tekst uit de README (model met onzekerheid; lokale
   condensbeveiliging blijft leidend).

## Toegankelijkheid & responsiveness

De UI is SVG-zwaar; kleur mag nooit de enige informatiedrager zijn.

- **Niet alleen kleur:** elk oordeel heeft ook een tekstlabel ("Beperkt koelen")
  en het dauwpunt-getal. Stippen/badges krijgen een tooltip/label met plaats +
  dauwpunt + oordeel.
- **Toetsenbord:** tijdslider bedienbaar met pijltjes; zoekveld en
  afspeelknop/instellingen volledig tab- en enter-bedienbaar.
- **ARIA:** icon-knoppen ("Gebruik mijn locatie", afspelen) krijgen
  `aria-label`; de grafiek en het kaartje een `role`/`aria-label` met een korte
  tekstuele samenvatting als fallback.
- **Responsive:** mobiel-first; layout stapelt netjes op smalle schermen
  (forecast boven, kaartje onder). SVG's schalen mee.

## Deployment

- `.github/workflows/forecast.yml` — **triggers expliciet beperkt** tot
  `schedule` (cron elke 6 uur) en `workflow_dispatch` (handmatig). **Géén** push-
  trigger op `data/**`, zodat de data-commit de workflow niet opnieuw start
  (geen self-trigger-lus).
  - Draait `fetch_forecast.py` en **commit `data/forecast.json` alleen als de
    inhoud daadwerkelijk wijzigt** (`git diff --quiet` check).
  - Deployt daarna de statische site (`web/` + `data/`) naar **GitHub Pages**.
  - Een aparte, lichte deploy bij wijzigingen in `web/**` mag via een tweede
    workflow met een `push`-trigger op `web/**` (los van de data-cron).

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

## Acceptatiecriteria

**Data (`forecast.json`):**
- `hours`, en per plaats `dewpoint` en `temp`, hebben **gelijke arraylengtes**.
- Geen `null`/`NaN` in een actieve forecast (anders: bestaande JSON behouden).
- `generated_at` aanwezig en parsebaar.

**Client:**
- Toont een **"verouderd"-melding** als `generated_at` ouder is dan **12 uur**.
- Werkt zonder JS-fouten als geolocatie geweigerd wordt (valt terug op zoeken).
- Onbekende plek in `localStorage` → valt terug op een default-plek.
- Slider/zoek/afspelen volledig met toetsenbord bedienbaar.

**Model (unit-getest):**
- Grenswaarden exact getest: dauwpunt **14.0 / 16.0 / 18.0 °C** vallen in de
  bedoelde klasse (grens hoort bij de gunstigere of ongunstigere zijde —
  expliciet vastleggen in de test).
- `aanbevolen aanvoer = max(Td + marge, min_temp)` klopt incl. de clamp op
  `min_temp` (bv. laag dauwpunt → uitkomst = `min_temp`).

## Aannames

- KNMI-model via Open-Meteo blijft sleutelloos en zonder CORS-issue voor de job
  (de browser raakt het nooit aan — alleen de Python-job).
- ~90 punten + ~4 dagen uurdata blijft een compacte `forecast.json` (richtlijn
  < ~300 kB ongecomprimeerd; Pages levert gzip).
- Drempels 14/16/18 zijn een verdedigbaar startpunt en eenvoudig te tunen.
