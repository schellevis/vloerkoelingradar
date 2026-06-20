# tests/test_summary.py
import json
import os
import tempfile
import unittest

from scripts.summary import aggregate, build_prompt, call_github_models, generate_summary
from scripts.fetch_forecast import run

FORECAST = {
    "generated_at": "2026-06-19T12:00:00+02:00",
    "model": "knmi_seamless",
    "hours": [
        "2026-06-19T00:00", "2026-06-19T12:00",
        "2026-06-20T00:00", "2026-06-20T12:00",
        "2026-06-21T00:00",
    ],
    "places": [
        {"name": "A", "dewpoint": [10.0, 14.0, 12.0, 16.0, 18.0]},
        {"name": "B", "dewpoint": [12.0, 20.0, 11.0, 21.0, 19.0]},
    ],
}


class FakeResp:
    """Minimale context-manager die urlopen nabootst."""
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def reply(content):
    return lambda req, timeout=None: FakeResp(
        {"choices": [{"message": {"content": content}}]}
    )


class TestAggregate(unittest.TestCase):
    def test_groups_first_n_days(self):
        agg = aggregate(FORECAST, days=2)
        self.assertEqual(len(agg), 2)
        # Dag 1 uren: A=[10,14], B=[12,20] -> mediaan van {10,12,14,20} = 13.0
        self.assertEqual(
            agg[0], {"date": "2026-06-19", "dew_min": 10.0, "dew_max": 20.0, "dew_median": 13.0}
        )
        # Dag 2 uren: A=[12,16], B=[11,21] -> mediaan van {11,12,16,21} = 14.0
        self.assertEqual(
            agg[1], {"date": "2026-06-20", "dew_min": 11.0, "dew_max": 21.0, "dew_median": 14.0}
        )

    def test_first_day_starts_at_now(self):
        # now = 12:00 op dag 1 -> de al voorbije 00:00-waarden tellen niet mee.
        # Resterende dag-1-waarden: A=14, B=20 -> mediaan = 17.0
        agg = aggregate(FORECAST, days=2, now="2026-06-19T12:00")
        self.assertEqual(
            agg[0], {"date": "2026-06-19", "dew_min": 14.0, "dew_max": 20.0, "dew_median": 17.0}
        )
        # Latere dagen liggen volledig in de toekomst en blijven ongewijzigd.
        self.assertEqual(agg[1]["dew_max"], 21.0)

    def test_skips_none_values(self):
        fc = {**FORECAST, "places": [{"name": "A", "dewpoint": [None, 14.0, None, None, None]}]}
        agg = aggregate(fc, days=1)
        self.assertEqual(agg[0]["dew_min"], 14.0)
        self.assertEqual(agg[0]["dew_median"], 14.0)


class TestPrompt(unittest.TestCase):
    def test_includes_dates_and_thresholds(self):
        msgs = build_prompt(aggregate(FORECAST, days=2), FORECAST["generated_at"])
        user = msgs[-1]["content"]
        self.assertIn("2026-06-19", user)
        self.assertIn("21", user)   # max van dag 2
        self.assertIn("16", user)   # drempeltekst
        self.assertEqual(msgs[0]["role"], "system")


class TestCall(unittest.TestCase):
    def test_parses_content_and_sets_auth(self):
        seen = {}

        def fake(req, timeout=None):
            seen["auth"] = req.get_header("Authorization")
            seen["body"] = json.loads(req.data.decode())
            return FakeResp({"choices": [{"message": {"content": "  Prima koelweer.  "}}]})

        out = call_github_models([{"role": "user", "content": "x"}], "tok", urlopen=fake)
        self.assertEqual(out, "Prima koelweer.")
        self.assertEqual(seen["auth"], "Bearer tok")
        self.assertEqual(seen["body"]["temperature"], 0)


class TestGenerateSummary(unittest.TestCase):
    def test_success(self):
        s = generate_summary(FORECAST, token="t", days=2, urlopen=reply("Goed te koelen."))
        self.assertEqual(s, "Goed te koelen.")

    def test_returns_none_on_error(self):
        def boom(req, timeout=None):
            raise OSError("netwerk weg")

        self.assertIsNone(generate_summary(FORECAST, token="t", days=2, urlopen=boom))

    def test_empty_text_is_none(self):
        self.assertIsNone(generate_summary(FORECAST, token="t", days=2, urlopen=reply("   ")))


class TestRunIntegration(unittest.TestCase):
    PLACES = [{"name": f"P{i}", "prov": "ZH", "lat": 52.0 + i / 100, "lon": 4.0 + i / 100}
              for i in range(2)]

    def _fetch_json(self, lats, lons):
        return [{"time": ["2026-06-19T00:00", "2026-06-19T01:00"],
                 "temperature_2m": [16.0, 15.0],
                 "dew_point_2m": [12.0, 11.5]} for _ in lats]

    def test_attaches_summary_when_present(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "forecast.json")
            run(path, fetch_json=self._fetch_json, now_iso="2026-06-19T14:00",
                places=self.PLACES, make_summary=lambda fc: "Landelijke indruk.")
            with open(path) as f:
                data = json.load(f)
        self.assertEqual(data["summary"], "Landelijke indruk.")
        self.assertEqual(data["summary_generated_at"], "2026-06-19T14:00")

    def test_omits_summary_when_none(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "forecast.json")
            run(path, fetch_json=self._fetch_json, now_iso="2026-06-19T14:00",
                places=self.PLACES, make_summary=lambda fc: None)
            with open(path) as f:
                data = json.load(f)
        self.assertNotIn("summary", data)


if __name__ == "__main__":
    unittest.main()
