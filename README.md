# Vloerkoelingradar

Een buienradar, maar dan voor **vloerkoeling**. In plaats van regen voorspelt de
radar of je de komende dag(en) **veilig kunt koelen**, op basis van de
dauwpuntvoorspelling uit **KNMI open data**.

> Dit is de vastgestelde v1. Het volledige ontwerp staat in
> `docs/superpowers/specs/2026-06-17-vloerkoelingradar-design.md`.

## Het idee in één zin

Zakt je aanvoerwater onder het **dauwpunt**, dan condenseert er vocht op de
vloer (nat, glad, schimmelrisico). Door het buitendauwpunt te voorspellen weet je
per uur of koelen kan en hoe koud het aanvoerwater mag zijn.

- 🟢 droge lucht (laag dauwpunt) → koel er flink op los
- 🔴 vochtige lucht (hoog dauwpunt) → niet koelen, of aanvoer hoog houden

## 1. Het "brein"

Het **dauwpunt** is het hoofdgetal én de basis voor de kleur. Dat maakt het
oordeel universeel: het hangt niet af van ieders binnentemperatuur, alleen van de
voorspelling.

- **Kleur/oordeel** op basis van het dauwpunt (vier niveaus):

  | Dauwpunt | Oordeel | Kleur |
  |---|---|---|
  | ≤ 14 °C | Volop koelen | 🟢 |
  | 14–16 °C | Gematigd | 🟡 |
  | 16–18 °C | Beperkt | 🟠 |
  | ≥ 18 °C | Niet koelen | 🔴 |

- **Aanbevolen aanvoertemperatuur** = `max(dauwpunt + marge, min-aanvoer)` — niet
  kouder dan dat, anders condens. **Veiligheidsmarge** (default 2 °C) en
  **minimale aanvoertemperatuur** (default 16 °C) zijn instelbaar en worden in
  `localStorage` onthouden. Deze instellingen veranderen alléén het advies, niet
  de kleur.

> Condensatie is een *ondergrens* op de aanvoer: je mag niet kouder dan
> `dauwpunt + marge`. De drempels staan als configuratie in `web/config.js`.

## 2. Databron

- **KNMI** via **Open-Meteo** (model `knmi_seamless`): uurlijkse voorspelling van
  temperatuur en dauwpunt, ~4 dagen vooruit. JSON, geen API-sleutel.

## 3. Architectuur: statisch + voorberekend

- Een **GitHub Actions-job** (elke 6 u) haalt de data op voor 91 plaatsen
  verspreid over alle provincies en schrijft één compacte
  `web/data/forecast.json` (ruwe dauwpunt-/temperatuurwaarden; kleur/oordeel
  rekent de browser).
- De **browser** leest alleen die voorberekende JSON. Geen live API of CORS
  nodig: snel, gratis te hosten, robuust.

## 4. "Waar woon je"

- Zoeken in een meegeleverde plaatsenlijst, **"Gebruik mijn locatie"**
  (browser-geolocatie), óf op de kaart een stip aanklikken → de radar kiest het
  dichtstbijzijnde forecast-punt. Onthouden in `localStorage`. Geen
  runtime-geocoding.

## 5. UI (forecast-first)

- **Nu-oordeel** in twee lagen: de *luchtvochtigheidssituatie* (gekleurd oordeel +
  dauwpunt) en *jouw aanvoeradvies* ("houd je aanvoer boven X °C").
- **Dag-ranges**: per dag een gekleurde balk van laagste → hoogste dauwpunt.
- **Uurgrafiek** met de exacte dauwpuntvoorspelling op een neutrale achtergrond,
  met per dag een gekleurde badge voor het hoogste dauwpunt.
- **Tijdslider + afspeelknop** om door de uren te scrubben — grafiek én kaart
  bewegen mee (de "radar"-animatie).
- **Landelijk SVG-kaartje** met een gekleurde stip per plaats; jouw plek omrand.

## 6. Deployment

- Volledig statisch: **GitHub Pages** via GitHub Actions (zie hieronder).

## Beperkingen & disclaimer

- De koppeling buiten- → binnendauwpunt klopt het best bij een geventileerde
  woning; een lokale dauwpunt-/condensatiebeveiliging op de installatie blijft
  leidend.
- Voorspellingen zijn modelwaarden met onzekerheid; dit is een hulpmiddel, geen
  vervanging voor de regeling van de installateur.

## Lokaal draaien & ontwikkelen

### Data-job uitvoeren

```bash
python3 -m scripts.fetch_forecast
```

Dit haalt de KNMI-dauwpuntvoorspelling op via Open-Meteo en schrijft
`web/data/forecast.json` met uurgegevens voor alle geconfigureerde plaatsen.

### Website lokaal serveren

```bash
python3 -m http.server 8000 --directory web
```

Open vervolgens `http://localhost:8000/` in je browser. De site is volledig
statisch — alle interactie gebeurt client-side, geen build nodig.

### Tests uitvoeren

**Frontend-logica** (vanilla JavaScript, ESM):
```bash
node --test web/test/*.test.mjs
```

**Data-job** (Python):
```bash
python3 -m unittest discover -s tests
```

**Alles samen:**
```bash
node --test web/test/*.test.mjs && python3 -m unittest discover -s tests
```

### Deployment

De site wordt automatisch gedeployed op twee manieren:

- **Data-update cron:** `.github/workflows/forecast.yml` draait elke 6 uur,
  haalt de nieuwste gegevens op, en deployt de site naar GitHub Pages.
- **Website-wijzigingen:** `.github/workflows/deploy-web.yml` deployt naar
  GitHub Pages bij elke push op main als iets in `web/**` verandert.

De site-root voor Pages is `web/` — alle assets en de `data/forecast.json`
zijn daar beschikbaar.
