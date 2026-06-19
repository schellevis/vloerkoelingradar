# scripts/summary.py
"""Genereert een korte landelijke dauwpunt-indruk via GitHub Models.

Draait alleen in de data-job (nooit in de browser). Stdlib-only: de call gaat
met urllib naar het OpenAI-compatibele GitHub Models-endpoint. De samenvatting is
optioneel — bij elke fout geeft generate_summary() None terug zodat de build
gewoon doorloopt en forecast.json zonder 'summary' wordt weggeschreven.
"""
import json
import urllib.request

# OpenAI-compatibel inferentie-endpoint van GitHub Models. Werkt met de Actions
# GITHUB_TOKEN mits de workflow `models: read` heeft.
ENDPOINT = "https://models.github.ai/inference/chat/completions"
DEFAULT_MODEL = "openai/gpt-4o-mini"

# Drempels spiegelen web/config.js (levels). Hier puur als prompttekst, zodat het
# model consistent met de UI-kleuren duidt; de Python-job classificeert zelf niet.
LEVELS_TEXT = (
    "Beoordeling gebeurt op het dauwpunt: t/m 16°C volop koelen, 16–18°C gematigd, "
    "18–21°C beperkt, boven 21°C niet koelen."
)

SYSTEM = (
    "Je bent een nuchtere Nederlandse weerduider voor een 'buienradar voor "
    "vloerkoeling'. Je vat de landelijke dauwpuntsituatie kort samen zodat iemand "
    "snapt of vloerkoeling de komende dagen veilig kan. Schrijf in het Nederlands, "
    "2 tot 4 zinnen, zonder opsommingstekens en zonder markdown. Verzin geen "
    "getallen; gebruik alleen de aangeleverde waarden. Noem niet elke dag apart als "
    "dat weinig toevoegt; benoem vooral de trend en eventuele risicodagen."
)


def aggregate(forecast, days=4):
    """Comprimeert de forecast tot landelijke min/gemiddeld/max dauwpunt per dag.

    Beperkt tot de eerste `days` kalenderdagen — genoeg context voor een paar
    zinnen, en weinig tokens (i.p.v. honderden plaatsen x honderden uren).
    """
    hours = forecast["hours"]
    places = forecast["places"]
    by_date = []          # volgorde van kalenderdagen
    idx_by_date = {}      # date -> uur-indices
    for i, h in enumerate(hours):
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
            "dew_mean": round(sum(vals) / len(vals), 1),
        })
    return out


def build_prompt(agg, generated_at):
    """Bouwt de chat-messages uit de geaggregeerde dagcijfers."""
    lines = [LEVELS_TEXT, "", f"Gegenereerd: {generated_at}.",
             "Landelijk dauwpunt (°C) per dag:"]
    for d in agg:
        lines.append(
            f"- {d['date']}: min {d['dew_min']}, gemiddeld {d['dew_mean']}, max {d['dew_max']}"
        )
    lines.append("")
    lines.append("Geef een korte algemene indruk van de koelomstandigheden in Nederland.")
    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": "\n".join(lines)},
    ]


def call_github_models(messages, token, *, model=DEFAULT_MODEL, endpoint=ENDPOINT,
                       temperature=0, max_tokens=400, timeout=30,
                       urlopen=urllib.request.urlopen):
    """POST naar GitHub Models en geeft de tekst van de eerste keuze terug."""
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
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode())
    return data["choices"][0]["message"]["content"].strip()


def generate_summary(forecast, *, token, days=4, model=DEFAULT_MODEL,
                     urlopen=urllib.request.urlopen):
    """Geeft een landelijke indruk-tekst of None als er iets misgaat."""
    try:
        agg = aggregate(forecast, days=days)
        if not agg:
            return None
        messages = build_prompt(agg, forecast.get("generated_at", ""))
        text = call_github_models(messages, token, model=model, urlopen=urlopen)
        return text or None
    except Exception:  # noqa: BLE001 - samenvatting is optioneel; nooit de build breken
        return None
