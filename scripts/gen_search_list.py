# scripts/gen_search_list.py
import json
from scripts.places import PLACES

def main():
    out = [{"name": p["name"], "lat": p["lat"], "lon": p["lon"]} for p in PLACES]
    with open("web/places-search.json", "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

if __name__ == "__main__":
    main()
