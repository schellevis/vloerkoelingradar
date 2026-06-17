# Concept: Vloerkoelingradar

Een buienradar, maar dan voor **vloerkoeling**. In plaats van regen voorspelt de
radar of je de komende dag(en) **veilig kunt koelen**, op basis van de
dauwpuntvoorspelling uit **KNMI open data**.

## Het idee in één zin

Zakt het vloeroppervlak onder het **dauwpunt** van de binnenlucht, dan
condenseert er vocht op de vloer (nat, glad, schimmelrisico). Door het
buitendauwpunt te voorspellen weet je per uur of koelen kan, en hoe koud het
aanvoerwater dan mag zijn.

- 🟢 droge lucht (laag dauwpunt) → koel er flink op los
- 🔴 vochtige lucht (hoog dauwpunt) → niet koelen, of aanvoer hoog houden

Het sleutelgetal:

```
koudst toegestane aanvoertemperatuur = dauwpunt + veiligheidsmarge
```

Hoe lager het dauwpunt, hoe kouder het water mag en hoe meer koelvermogen je
hebt.

## 1. De natuurkunde (het "brein")

- Het buitendauwpunt benadert het binnendauwpunt bij een geventileerde woning:
  dauwpunt blijft — anders dan temperatuur — vrijwel behouden bij ventileren en
  bij koelen/verwarmen zonder ontvochtiging.
- Koelkwaliteit volgt uit het beschikbare temperatuurverschil:
  `ΔT = binnentemperatuur − (dauwpunt + marge)`.
  Groot ΔT = uitstekend koelen; ΔT rond nul = niet koelen.
- Vijf niveaus met kleurcodes (uitstekend → goed → matig → beperkt → niet).
- Instelbaar door de gebruiker: veiligheidsmarge, binnentemperatuur,
  praktijkondergrens van de aanvoer (~16 °C).

> **Terminologie:** voor koelen is condensatie een *ondergrens* op de
> aanvoertemperatuur. De radar presenteert daarom de *koudst toegestane*
> aanvoer — dat is de grenswaarde die bepaalt hoe hard je mag koelen.

## 2. Databron

- **KNMI HARMONIE-AROME**: uurlijkse voorspelling van temperatuur en relatieve
  vochtigheid (→ dauwpunt), ~4 dagen vooruit.
- Praktisch te ontsluiten via het KNMI-model in **Open-Meteo** (JSON, geen
  API-sleutel, geen zwaar GRIB-/NetCDF-gedoe).

## 3. Architectuur: statisch + voorberekend

- Een **server-side job** (bijv. GitHub Actions, elke paar uur) haalt de data op
  voor ~90 plaatsen verspreid over alle provincies en schrijft één compacte
  `forecast.json`.
- De **browser** leest alleen die voorberekende JSON. Geen live API of CORS
  nodig: snel, gratis te hosten, robuust.

## 4. "Waar woon je"

- Zoeken in een meegeleverde plaatsenlijst, óf op de kaart klikken → de radar
  kiest het dichtstbijzijnde meetpunt. Geen runtime-geocoding nodig.

## 5. UI (de "radar")

- Kaart van Nederland met per plaats een gekleurde stip, plus een
  **tijdslider + afspeelknop** om door de komende dagen te scrubben (de animatie).
- Detailpaneel voor de gekozen plaats: oordeel "nu", dauwpunt/temperatuur/RV,
  een **uurgrafiek** met gekleurde koelzones, en een **dagoverzicht**.

## 6. Deployment

- Volledig statisch: **GitHub Pages** (via de Action) of **Vercel**.

## Beperkingen & disclaimer

- De koppeling buiten- → binnendauwpunt klopt het best bij een geventileerde
  woning; een lokale dauwpunt-/condensatiebeveiliging op de installatie blijft
  leidend.
- Voorspellingen zijn modelwaarden met onzekerheid; dit is een hulpmiddel, geen
  vervanging voor de regeling van de installateur.

## Open vragen / keuzes

- Bevestiging van de term "maximale aanvoertemperatuur" → gepresenteerd als
  "koudst toegestane aanvoer". Akkoord?
- Verversingsfrequentie van de data (elke 6 u?) en aantal/spreiding plaatsen.
- Wel/geen interpolatie tussen meetpunten voor een vloeiende heatmap.
