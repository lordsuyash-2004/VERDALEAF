# Verdaleaf iteration 6: multi-language detection, localized PDF, history search via *_en, weather risk
import base64
import os
import re

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TOKEN = "qa-demo-session-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
DEVANAGARI = re.compile(r"[\u0900-\u097F]")
KANNADA = re.compile(r"[\u0C80-\u0CFF]")

with open("/tmp/leaf.jpg", "rb") as f:
    IMG = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()

_cache = {}


def _detect(lang, auth=True):
    if lang in _cache:
        return _cache[lang]
    body = {"image_base64": IMG}
    if lang:
        body["language"] = lang
    r = requests.post(f"{BASE_URL}/api/detect", json=body, headers=AUTH if auth else {}, timeout=120)
    assert r.status_code == 200, r.text[:300]
    _cache[lang] = r.json()
    return _cache[lang]


def _text(d):
    return " ".join([d["plant"], d["disease_name"]] + d["symptoms"] + d["treatments"] + d["prevention"])


# --- Detection languages ---
class TestDetectLanguage:
    def test_default_english(self):
        d = _detect(None)
        assert d["language"] == "en"
        assert not DEVANAGARI.search(_text(d)) and not KANNADA.search(_text(d))
        assert d["severity"] in ("low", "moderate", "severe")

    def test_hindi(self):
        d = _detect("hi")
        assert d["language"] == "hi"
        assert DEVANAGARI.search(d["disease_name"]) or DEVANAGARI.search(d["plant"])
        assert DEVANAGARI.search(" ".join(d["symptoms"] + d["treatments"] + d["prevention"]))
        assert re.match(r"^[\x00-\x7F]+$", d["plant_en"]) and re.match(r"^[\x00-\x7F]+$", d["disease_name_en"])
        assert d["severity"] in ("low", "moderate", "severe")

    def test_kannada(self):
        d = _detect("kn")
        assert d["language"] == "kn"
        assert KANNADA.search(d["disease_name"]) or KANNADA.search(d["plant"])
        assert KANNADA.search(" ".join(d["symptoms"] + d["treatments"] + d["prevention"]))
        assert re.match(r"^[\x00-\x7F]+$", d["disease_name_en"])
        assert d["severity"] in ("low", "moderate", "severe")

    def test_invalid_language(self):
        r = requests.post(f"{BASE_URL}/api/detect", json={"image_base64": IMG, "language": "fr"}, timeout=30)
        assert r.status_code == 422


# --- PDF ---
class TestPdf:
    @pytest.mark.parametrize("lang", ["en", "hi", "kn"])
    def test_pdf(self, lang):
        d = _detect(None if lang == "en" else lang)
        payload = {k: v for k, v in d.items() if k != "user_id"}
        r = requests.post(f"{BASE_URL}/api/report/pdf", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:4] == b"%PDF" and len(r.content) > 2000
        print(lang, r.headers.get("content-disposition"), len(r.content))


# --- History ---
class TestHistory:
    def test_search_by_english_name(self):
        d = _detect("hi")
        term = d["disease_name_en"].split()[0]
        r = requests.get(f"{BASE_URL}/api/history", params={"q": term}, headers=AUTH, timeout=30)
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()["items"]]
        assert d["id"] in ids or r.json()["total"] > len(ids)

    def test_kn_saved(self):
        d = _detect("kn")
        r = requests.get(f"{BASE_URL}/api/history", params={"q": d["disease_name_en"], "limit": 60}, headers=AUTH, timeout=30)
        assert r.status_code == 200
        assert any(i["id"] == d["id"] and i["language"] == "kn" for i in r.json()["items"])

    def test_stats(self):
        r = requests.get(f"{BASE_URL}/api/history/stats", headers=AUTH, timeout=30)
        assert r.status_code == 200
        s = r.json()
        assert s["total"] >= 1 and isinstance(s["healthy"], int)
        assert s["top_issue"] is None or not DEVANAGARI.search(s["top_issue"])

    def test_regex_special_chars(self):
        r = requests.get(f"{BASE_URL}/api/history", params={"q": "(("}, headers=AUTH, timeout=30)
        print("regex q status", r.status_code)
        assert r.status_code in (200, 400)


# --- Weather ---
class TestWeather:
    def test_geocode(self):
        r = requests.get(f"{BASE_URL}/api/weather/geocode", params={"q": "Mysuru"}, timeout=30)
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 1
        for k in ("name", "admin1", "country", "latitude", "longitude"):
            assert k in lst[0]

    def test_geocode_short(self):
        assert requests.get(f"{BASE_URL}/api/weather/geocode", params={"q": "M"}, timeout=30).status_code == 422

    def test_geocode_nonsense(self):
        r = requests.get(f"{BASE_URL}/api/weather/geocode", params={"q": "zzqxqzzqx"}, timeout=30)
        assert r.status_code == 200 and r.json() == []

    def test_risk(self):
        r = requests.get(f"{BASE_URL}/api/weather/risk", params={"lat": 12.97, "lon": 77.59}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["overall_level"] in ("low", "moderate", "high")
        assert isinstance(d["headline"], str) and d["headline"]
        for k in ("temperature", "humidity"):
            assert k in d["current"]
        assert [x["key"] for x in d["risks"]] == ["fungal", "bacterial", "heat"]
        for x in d["risks"]:
            assert x["level"] in ("low", "moderate", "high")
            assert 0 <= x["score"] <= 100
            assert x["reason"] and isinstance(x["advice"], list) and x["advice"]
        assert len(d["daily"]) == 3

    def test_risk_invalid(self):
        assert requests.get(f"{BASE_URL}/api/weather/risk", params={"lat": 95, "lon": 77}, timeout=30).status_code == 422
        assert requests.get(f"{BASE_URL}/api/weather/risk", params={"lat": 10}, timeout=30).status_code == 422
