# scripts/forecast_build.py
"""Pure functies om Open-Meteo-antwoorden om te zetten naar forecast.json."""
import math


def _round1(x):
    return round(float(x), 1)


def build_forecast(generated_at, model, places, hourly_by_place):
    if not hourly_by_place:
        raise ValueError("geen hourly-data")
    if len(places) != len(hourly_by_place):
        raise ValueError(f"places ({len(places)}) != hourly ({len(hourly_by_place)})")
    hours = list(hourly_by_place[0]["time"])
    for h in hourly_by_place:
        if list(h["time"]) != hours:
            raise ValueError("ongelijke time-arrays tussen plaatsen")
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
