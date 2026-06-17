# scripts/places.py
"""NL forecast-punten: één per gemeente (centroïde + provincie).

De lijst wordt gegenereerd door scripts/build_places.py uit de gemeente- en
provinciegrenzen en bewaard in scripts/places.json. Elk item:
{"name", "prov", "code" (statcode), "lat", "lon"}.
"""
import json
import os

_HERE = os.path.dirname(__file__)

with open(os.path.join(_HERE, "places.json"), encoding="utf-8") as _f:
    PLACES = json.load(_f)
