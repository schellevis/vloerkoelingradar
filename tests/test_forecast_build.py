# tests/test_forecast_build.py
import math, unittest
from scripts.forecast_build import build_forecast, validate

PLACES = [{"name": "Gouda", "prov": "ZH", "lat": 52.012, "lon": 4.704}]
HOURLY = [{"time": ["2026-06-17T00:00", "2026-06-17T01:00"],
           "temperature_2m": [16.04, 15.36], "dew_point_2m": [12.31, 12.09]}]

class TestBuild(unittest.TestCase):
    def test_build_shape_and_rounding(self):
        fc = build_forecast("2026-06-17T14:00:00+02:00", "knmi_seamless", PLACES, HOURLY)
        self.assertEqual(fc["model"], "knmi_seamless")
        self.assertEqual(fc["hours"], ["2026-06-17T00:00", "2026-06-17T01:00"])
        p = fc["places"][0]
        self.assertEqual(p["name"], "Gouda")
        self.assertEqual(p["dewpoint"], [12.3, 12.1])
        self.assertEqual(p["temp"], [16.0, 15.4])
        self.assertNotIn("time", p)  # tijden niet per plaats herhaald

    def test_validate_ok(self):
        fc = build_forecast("t", "m", PLACES, HOURLY)
        validate(fc)  # geen exception

    def test_validate_length_mismatch(self):
        fc = build_forecast("t", "m", PLACES, HOURLY)
        fc["places"][0]["dewpoint"].pop()
        with self.assertRaises(ValueError):
            validate(fc)

    def test_validate_rejects_nan(self):
        bad = [{"time": ["2026-06-17T00:00"], "temperature_2m": [None],
                "dew_point_2m": [float("nan")]}]
        fc = build_forecast("t", "m", PLACES, bad)
        with self.assertRaises(ValueError):
            validate(fc)

    def test_build_rejects_place_count_mismatch(self):
        with self.assertRaises(ValueError):
            build_forecast("t", "m", PLACES, [])  # 1 plaats, 0 hourly

    def test_build_rejects_differing_time_arrays(self):
        places2 = PLACES + [{"name": "X", "prov": "GR", "lat": 53.0, "lon": 6.0}]
        hourly2 = HOURLY + [{"time": ["2026-06-17T00:00"],
                             "temperature_2m": [1.0], "dew_point_2m": [1.0]}]
        with self.assertRaises(ValueError):
            build_forecast("t", "m", places2, hourly2)

if __name__ == "__main__":
    unittest.main()
