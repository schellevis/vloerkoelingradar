# scripts/fetch_forecast.py
"""Haalt KNMI-uurdata op via Open-Meteo en schrijft data/forecast.json."""
import json
import time
import os
import urllib.parse
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

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
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    tmp = out_path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(forecast, f, separators=(",", ":"))
    os.replace(tmp, out_path)
    return forecast


def _now_amsterdam_iso():
    # zoneinfo regelt zomer-/wintertijd correct (geen hardcoded offset).
    return datetime.now(ZoneInfo("Europe/Amsterdam")).replace(microsecond=0).isoformat()


if __name__ == "__main__":
    run("web/data/forecast.json", fetch_json=http_fetch_json, now_iso=_now_amsterdam_iso())
    print("web/data/forecast.json geschreven")
