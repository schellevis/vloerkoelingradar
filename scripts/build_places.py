"""Genereert scripts/places.json uit de gemeente- en provinciegrenzen.

Per gemeente (uit web/gemeenten.geo.json) wordt een representatieve centroïde
berekend en de provincie bepaald via point-in-polygon tegen
scripts/provincie.geo.json. Pure stdlib; draai opnieuw bij een nieuwe
gemeente-indeling.

Bron grenzen: https://cartomap.github.io/nl/wgs84/gemeente_2024.geojson
              https://cartomap.github.io/nl/wgs84/provincie_2024.geojson
"""
import json
import os

HERE = os.path.dirname(__file__)
GEMEENTEN = os.path.join(HERE, "..", "web", "gemeenten.geo.json")
PROVINCIES = os.path.join(HERE, "provincie.geo.json")
OUT = os.path.join(HERE, "places.json")


def _rings(geom):
    """Buitenring(en) van een (Multi)Polygon."""
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [poly[0] for poly in geom["coordinates"]]
    return []


def _area_centroid(ring):
    """Oppervlakte-gewogen centroïde (shoelace) van één ring."""
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    a *= 0.5
    if a == 0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    return cx / (6 * a), cy / (6 * a)


def centroid(geom):
    """Centroïde van de grootste ring (representatief punt van de gemeente)."""
    rings = sorted(_rings(geom), key=len, reverse=True)
    return _area_centroid(rings[0])


def _point_in_ring(pt, ring):
    x, y = pt
    inside = False
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        if ((y0 > y) != (y1 > y)) and (x < (x1 - x0) * (y - y0) / (y1 - y0) + x0):
            inside = not inside
    return inside


def province_of(pt, provinces):
    """Provincie waarin het punt valt; anders dichtstbijzijnde provincie-centroïde."""
    for f in provinces["features"]:
        for ring in _rings(f["geometry"]):
            if _point_in_ring(pt, ring):
                return f["properties"]["statnaam"]
    # Fallback: dichtstbijzijnde provincie-centroïde (randgevallen langs de kust).
    best, bestd = None, float("inf")
    px, py = pt
    for f in provinces["features"]:
        cx, cy = centroid(f["geometry"])
        d = (cx - px) ** 2 + (cy - py) ** 2
        if d < bestd:
            bestd, best = d, f["properties"]["statnaam"]
    return best


def build():
    with open(GEMEENTEN) as f:
        gemeenten = json.load(f)
    with open(PROVINCIES) as f:
        provincies = json.load(f)

    places = []
    for feat in gemeenten["features"]:
        lon, lat = centroid(feat["geometry"])
        prov = province_of((lon, lat), provincies)
        places.append({
            "name": feat["properties"]["statnaam"],
            "prov": prov,
            "code": feat["properties"]["statcode"],
            "lat": round(lat, 4),
            "lon": round(lon, 4),
        })
    places.sort(key=lambda p: p["name"])
    with open(OUT, "w") as f:
        json.dump(places, f, ensure_ascii=False, separators=(",", ":"))
    return places


if __name__ == "__main__":
    places = build()
    provs = sorted({p["prov"] for p in places})
    print(f"{len(places)} gemeenten -> {OUT}")
    print(f"{len(provs)} provincies: {provs}")
