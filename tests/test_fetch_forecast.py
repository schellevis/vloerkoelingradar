# tests/test_fetch_forecast.py
import json, os, tempfile, unittest
from scripts.fetch_forecast import fetch_all, run

def make_hourly(seed):
    return {"time": ["2026-06-17T00:00", "2026-06-17T01:00"],
            "temperature_2m": [16.0 + seed, 15.0 + seed],
            "dew_point_2m": [12.0 + seed, 11.5 + seed]}

PLACES = [{"name": f"P{i}", "prov": "ZH", "lat": 52.0 + i/100, "lon": 4.0 + i/100}
          for i in range(3)]

class TestFetch(unittest.TestCase):
    def test_fetch_all_batches_and_orders(self):
        calls = []
        def fetch_json(lats, lons):
            calls.append(len(lats))
            return [make_hourly(i) for i in range(len(lats))]
        out = fetch_all(PLACES, fetch_json, batch_size=2)
        self.assertEqual(len(out), 3)
        self.assertEqual(calls, [2, 1])  # 2 batches: 2 + 1

    def test_fetch_all_retries_then_fails(self):
        def always_fail(lats, lons):
            raise OSError("boom")
        with self.assertRaises(RuntimeError):
            fetch_all(PLACES, always_fail, batch_size=3, retries=2)

    def test_run_writes_only_valid(self):
        def fetch_json(lats, lons):
            return [make_hourly(i) for i in range(len(lats))]
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "forecast.json")
            run(path, fetch_json=fetch_json, now_iso="2026-06-17T14:00:00+02:00", places=PLACES)
            data = json.load(open(path))
            self.assertEqual(len(data["places"]), 3)
            self.assertEqual(data["hours"], ["2026-06-17T00:00", "2026-06-17T01:00"])

    def test_run_keeps_existing_on_bad_data(self):
        def bad(lats, lons):
            return [{"time": ["2026-06-17T00:00"], "temperature_2m": [None],
                     "dew_point_2m": [None]} for _ in lats]
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "forecast.json")
            with open(path, "w") as f:
                f.write('{"keep":true}')
            with self.assertRaises(ValueError):
                run(path, fetch_json=bad, now_iso="t", places=PLACES)
            self.assertEqual(json.load(open(path)), {"keep": True})  # ongewijzigd

if __name__ == "__main__":
    unittest.main()
