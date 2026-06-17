# Vloerkoelingradar

Een buienradar, maar dan voor **vloerkoeling**. In plaats van regen voorspelt de
radar of je de komende ~4 dagen **veilig kunt koelen**, op basis van de
**dauwpunt**voorspelling uit het KNMI-model (via Open-Meteo).

Zakt je aanvoerwater onder het dauwpunt, dan condenseert er vocht op de vloer
(nat, glad, schimmelrisico). Door het dauwpunt per uur te voorspellen weet je
wanneer koelen kan — en hoe koud het aanvoerwater dan mag zijn.

- 🟢 droge lucht (laag dauwpunt) → koel er flink op los
- 🔴 vochtige lucht (hoog dauwpunt) → niet koelen, of de aanvoer hoog houden

## Hoe het werkt

Het **dauwpunt** is het hoofdgetal én de basis voor de kleur. Daardoor is het
oordeel universeel — het hangt niet af van ieders binnentemperatuur, alleen van
de voorspelling.

| Dauwpunt | Oordeel | Kleur |
|---|---|---|
| ≤ 14 °C | Volop koelen | 🟢 groen |
| 14–16 °C | Gematigd | 🟡 geel |
| 16–18 °C | Beperkt | 🟠 oranje |
| ≥ 18 °C | Niet koelen | 🔴 rood |

Daarnaast toont de radar je **aanbevolen aanvoertemperatuur**:

```
aanbevolen aanvoer = max(dauwpunt + veiligheidsmarge, minimale aanvoer)
```

Niet kouder dan dat, anders condens. De **veiligheidsmarge** (default 2 °C) en
**minimale aanvoertemperatuur** (default 16 °C) zijn instelbaar en worden in je
browser (`localStorage`) onthouden. Ze veranderen alléén het advies, niet de
kleur.

> Condensatie is een *ondergrens*: je mag niet kóuder dan `dauwpunt + marge`.

## De app

Forecast-first: je kiest je plek (zoeken, **"Gebruik mijn locatie"**, of klik een
stip op de kaart) en ziet meteen:

- **Nu-oordeel** in twee lagen — de luchtvochtigheidssituatie (kleur + dauwpunt)
  en jouw aanvoeradvies.
- **Dag-ranges** — per dag een gekleurde balk van laagste → hoogste dauwpunt.
- **Uurgrafiek** — de exacte dauwpuntvoorspelling, met per dag een gekleurde
  badge voor het hoogste dauwpunt.
- **Tijdslider + afspeelknop** — scrub door de uren; grafiek én kaart bewegen mee.
- **Landelijk kaartje** — een gekleurde stip per plaats (de "radar"-vibe).

## Architectuur

Volledig statisch, twee delen:

1. **Data-job** (Python, GitHub Actions, elke 6 u): haalt uurlijkse temperatuur +
   dauwpunt op voor 91 plaatsen uit het KNMI-model via Open-Meteo en schrijft één
   compacte `web/data/forecast.json` (alleen ruwe waarden).
2. **Browser** (vanilla ES modules, geen build, geen libraries): leest alleen die
   JSON en rekent kleur/advies client-side. Geen live API, geen CORS, geen
   API-sleutel.

Het volledige ontwerp en de besluiten staan in
[`docs/superpowers/specs/2026-06-17-vloerkoelingradar-design.md`](docs/superpowers/specs/2026-06-17-vloerkoelingradar-design.md).

## Lokaal draaien

```bash
# 1. (optioneel) verse data ophalen — er staat al een dataset in de repo
python3 -m scripts.fetch_forecast        # schrijft web/data/forecast.json

# 2. site serveren (de site-root is web/)
python3 -m http.server 8000 --directory web
# open http://localhost:8000/
```

## Tests

```bash
node --test web/test/*.test.mjs          # frontend-logica (vanilla ESM)
python3 -m unittest discover -s tests    # data-job (Python stdlib)
```

## Deployment (GitHub Pages)

Eenmalig: in **Settings → Pages → Source = "GitHub Actions"**. Daarna:

- `.github/workflows/forecast.yml` — cron (elke 6 u) + handmatig: haalt data op,
  commit `forecast.json` als die wijzigt, en deployt naar Pages.
- `.github/workflows/deploy-web.yml` — deployt bij wijzigingen in `web/**`.

## Aanpassen

Alle "knoppen" staan op één plek:

- **`web/config.js`** — kleurdrempels, defaults, instellingsgrenzen, dauwpunt-as,
  NL-bounding-box, model en aantal dagen.
- **`web/style.css`** — design-tokens (kleuren, spacing, fonts) als
  CSS-variabelen.
- **`scripts/places.py`** — de 91 forecast-punten.

## Beperkingen & disclaimer

De koppeling buiten- → binnendauwpunt klopt het best bij een geventileerde
woning; een lokale dauwpunt-/condensatiebeveiliging op de installatie blijft
leidend. Voorspellingen zijn modelwaarden met onzekerheid — dit is een
hulpmiddel, geen vervanging voor de regeling van de installateur.
