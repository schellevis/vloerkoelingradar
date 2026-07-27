# scripts/summary.py
"""Genereert een korte landelijke dauwpunt-indruk via OpenCode Go.

Draait alleen in de data-job (nooit in de browser). Stdlib-only: de call gaat
met urllib naar het OpenAI-compatibele OpenCode Go chat/completions-endpoint. De
samenvatting is optioneel — bij elke fout geeft generate_summary() None terug
zodat de build gewoon doorloopt en forecast.json zonder 'summary' wordt
weggeschreven.
"""
import json
import statistics
import urllib.request

# OpenAI-compatibel inferentie-endpoint van OpenCode Go (betaald abonnement,
# https://opencode.ai/docs/go/). Werkt met een OpenCode API-key via
# Authorization: Bearer <key> — geen third-party libs nodig, gewoon urllib.
ENDPOINT = "https://opencode.ai/zen/go/v1/chat/completions"
# mimo-v2.5: klein/snel model dat consistent bruikbare NL-tekst aflevert —
# geverifieerd tegen de live API. Het is wél een reasoning-model: het verstopt
# gedachtestappen in reasoning_content, dat meetelt in max_tokens. Het
# tokenverbruik daarvan varieerde in tests van ~200 tot ~550 tokens bij
# identieke prompts (temperature=0 voorkomt dat dus niet) — MAX_TOKENS heeft
# daarom ruime marge. Andere Go-modellen (bv. deepseek-v4-flash, glm-5,
# kimi-k2.5) hebben nog veel hogere/onvoorspelbaardere reasoning-overhead en
# kapten de zichtbare content vaker af.
DEFAULT_MODEL = "mimo-v2.5"
MAX_TOKENS = 1200

# Drempels spiegelen web/config.js (levels). LEVELS_TEXT gaat in de prompt zodat
# het model de UI-labels herkent; _classify() past dezelfde drempels toe in Python
# zodat de LLM de classificatie niet zelf hoeft te raden.
LEVELS_TEXT = (
    "Beoordeling gebeurt op het dauwpunt: t/m 16°C volop koelen, 16–18°C gematigd, "
    "18–21°C beperkt, boven 21°C niet koelen."
)


def _classify(dewpoint):
    """Dauwpunt → level-label, spiegelt web/config.js levels.

    Drempels moeten gelijk blijven aan LEVELS_TEXT; daar staat dezelfde tabel
    in prompt-vorm zodat de LLM de UI-labels herkent.
    """
    if dewpoint <= 16:
        return "volop koelen"
    if dewpoint <= 18:
        return "gematigd"
    if dewpoint <= 21:
        return "beperkt"
    return "niet koelen"


SYSTEM = (
    "Je bent een nuchtere Nederlandse weerduider voor een 'buienradar voor "
    "vloerkoeling'. Je vat de landelijke dauwpuntsituatie kort samen zodat iemand "
    "snapt of vloerkoeling de komende dagen veilig kan. Schrijf in het Nederlands, "
    "2 tot 4 zinnen, zonder opsommingstekens en zonder markdown. Verzin geen "
    "getallen; gebruik alleen de aangeleverde waarden. Noem niet elke dag apart als "
    "dat weinig toevoegt; benoem vooral de trend en eventuele risicodagen.\n\n"
    "Het algemene beeld per dag baseer je op het mediane dauwpunt — dat is wat de "
    "doorsnee gemeente ervaart, en sluit aan bij wat iemand op de eigen "
    "forecast-grafiek ziet. De classificatie daarvan (volop koelen, gematigd, "
    "beperkt, niet koelen) is al voor je gedaan; gebruik die labels letterlijk en "
    "consistent met de UI. De meegeleverde spreiding (laagste–hoogste) is de "
    "landelijke bandbreedte over alle gemeenten en uren: dat zijn de uitersten, "
    "niet het algemene beeld. Noem een hoge bovenkant hooguit als nuance voor "
    "warmere of vochtigere regio's, en laat 'm het landelijke oordeel niet "
    "domineren."
)


def aggregate(forecast, days=4, now=None):
    """Comprimeert de forecast tot landelijk min/mediaan/max dauwpunt per dag.

    De **mediaan** is de centrale maat (wat de doorsnee gemeente ervaart) en
    bepaalt straks de classificatie; min/max blijven mee als landelijke
    spreiding (uitersten) — robuuster dan het gemiddelde, dat door een handvol
    warme/vochtige uitschieters omhoog werd getrokken en de samenvatting
    alarmerender maakte dan de lokale forecast-grafiek.

    Beperkt tot de eerste `days` kalenderdagen — genoeg context voor een paar
    zinnen, en weinig tokens (i.p.v. honderden plaatsen x honderden uren).

    `now` (een label/ISO-string) negeert al voorbije uren, zodat de eerste dag
    vanaf het huidige uur telt i.p.v. een dagcijfer dat door de al verstreken
    (koele) nacht omlaag wordt getrokken. Uur-labels zijn lexicografisch te
    vergelijken, dus we knippen beide op "YYYY-MM-DDTHH".
    """
    hours = forecast["hours"]
    places = forecast["places"]
    cutoff = now[:13] if now else None
    by_date = []          # volgorde van kalenderdagen
    idx_by_date = {}      # date -> uur-indices
    for i, h in enumerate(hours):
        if cutoff and h[:13] < cutoff:
            continue
        d = h[:10]
        if d not in idx_by_date:
            if len(by_date) >= days:
                break
            idx_by_date[d] = []
            by_date.append(d)
        idx_by_date[d].append(i)
    out = []
    for d in by_date:
        idxs = idx_by_date[d]
        vals = [v for p in places for v in (p["dewpoint"][i] for i in idxs) if v is not None]
        if not vals:
            continue
        out.append({
            "date": d,
            "dew_min": round(min(vals), 1),
            "dew_max": round(max(vals), 1),
            "dew_median": round(statistics.median(vals), 1),
        })
    return out


def build_prompt(agg, generated_at):
    """Bouwt de chat-messages uit de geaggregeerde dagcijfers."""
    lines = [LEVELS_TEXT, "", f"Gegenereerd: {generated_at}.",
             "Landelijk dauwpunt (°C) per dag — mediaan bepaalt het beeld, "
             "min–max is de landelijke spreiding (uitersten):"]
    for d in agg:
        lines.append(
            f"- {d['date']}: doorgaans {d['dew_median']} "
            f"({_classify(d['dew_median'])}); landelijke spreiding "
            f"{d['dew_min']}–{d['dew_max']}"
        )
    lines.append("")
    lines.append("Geef een korte algemene indruk van de koelomstandigheden in Nederland.")
    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": "\n".join(lines)},
    ]


def call_opencode(messages, token, *, model=DEFAULT_MODEL, endpoint=ENDPOINT,
                  temperature=0, max_tokens=MAX_TOKENS, timeout=30,
                  urlopen=urllib.request.urlopen):
    """POST naar OpenCode Go en geeft de tekst van de eerste keuze terug."""
    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }).encode()
    req = urllib.request.Request(
        endpoint, data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            # Cloudflare voor opencode.ai blokkeert urllib's default
            # "Python-urllib/x.y" User-Agent (error 1010); een eigen waarde
            # is genoeg om erlangs te komen.
            "User-Agent": "vloerkoelingradar-forecast-job/1.0",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode())
    return data["choices"][0]["message"]["content"].strip()


def generate_summary(forecast, *, token, days=4, model=DEFAULT_MODEL,
                     urlopen=urllib.request.urlopen):
    """Geeft een landelijke indruk-tekst of None als er iets misgaat."""
    try:
        agg = aggregate(forecast, days=days, now=forecast.get("generated_at"))
        if not agg:
            return None
        messages = build_prompt(agg, forecast.get("generated_at", ""))
        text = call_opencode(messages, token, model=model, urlopen=urlopen)
        return text or None
    except Exception:  # noqa: BLE001 - samenvatting is optioneel; nooit de build breken
        return None
