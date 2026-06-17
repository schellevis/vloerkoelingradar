# tests/test_places.py
import unittest
from scripts.places import PLACES

PROVS = {"GR","FR","DR","OV","FL","GE","UT","NH","ZH","ZE","NB","LI"}

class TestPlaces(unittest.TestCase):
    def test_count_and_shape(self):
        self.assertGreaterEqual(len(PLACES), 80)
        for p in PLACES:
            self.assertEqual({"name","prov","lat","lon"}, set(p))
            self.assertIsInstance(p["name"], str)
            self.assertIn(p["prov"], PROVS)
            self.assertTrue(50.5 <= p["lat"] <= 53.7, p)
            self.assertTrue(3.2 <= p["lon"] <= 7.3, p)

    def test_all_provinces_covered(self):
        self.assertEqual(PROVS, {p["prov"] for p in PLACES})

    def test_names_unique(self):
        names = [p["name"] for p in PLACES]
        self.assertEqual(len(names), len(set(names)))

if __name__ == "__main__":
    unittest.main()
