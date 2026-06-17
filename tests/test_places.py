# tests/test_places.py
import unittest
from scripts.places import PLACES

PROVS = {
    "Groningen", "Fryslân", "Drenthe", "Overijssel", "Flevoland", "Gelderland",
    "Utrecht", "Noord-Holland", "Zuid-Holland", "Zeeland", "Noord-Brabant", "Limburg",
}


class TestPlaces(unittest.TestCase):
    def test_count_and_shape(self):
        self.assertGreaterEqual(len(PLACES), 300)  # ~342 gemeenten
        for p in PLACES:
            self.assertEqual({"name", "prov", "code", "lat", "lon"}, set(p))
            self.assertIsInstance(p["name"], str)
            self.assertIn(p["prov"], PROVS)
            self.assertTrue(p["code"].startswith("GM"))
            self.assertTrue(50.5 <= p["lat"] <= 53.7, p)
            self.assertTrue(3.2 <= p["lon"] <= 7.3, p)

    def test_all_provinces_covered(self):
        self.assertEqual(PROVS, {p["prov"] for p in PLACES})

    def test_names_and_codes_unique(self):
        names = [p["name"] for p in PLACES]
        codes = [p["code"] for p in PLACES]
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(len(codes), len(set(codes)))


if __name__ == "__main__":
    unittest.main()
