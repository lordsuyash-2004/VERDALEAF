# Verdaleaf weather regression: public geocode/risk endpoints and CORS credential mismatch signal
import os

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def test_weather_geocode_live_200(api_client):
    response = api_client.get(f"{BASE_URL}/api/weather/geocode", params={"q": "Bengaluru"}, timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    first = data[0]
    assert isinstance(first.get("name"), str) and first["name"]
    assert isinstance(first.get("latitude"), (int, float))
    assert isinstance(first.get("longitude"), (int, float))


def test_weather_risk_live_coords_200(api_client):
    response = api_client.get(
        f"{BASE_URL}/api/weather/risk",
        params={"lat": 13.15, "lon": 77.61},
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["overall_level"] in ("low", "moderate", "high")
    assert isinstance(data["headline"], str) and data["headline"]
    assert isinstance(data.get("daily"), list) and len(data["daily"]) == 3
    assert [x["key"] for x in data["risks"]] == ["fungal", "bacterial", "heat"]
    assert data.get("latitude") == pytest.approx(13.15, abs=0.3)
    assert data.get("longitude") == pytest.approx(77.61, abs=0.3)


@pytest.mark.parametrize(
    "params",
    [
        {"lat": 91, "lon": 77.61},
        {"lat": 13.15, "lon": 181},
        {"lon": 77.61},
        {"lat": 13.15},
    ],
)
def test_weather_risk_invalid_lat_lon_422(api_client, params):
    response = api_client.get(f"{BASE_URL}/api/weather/risk", params=params, timeout=30)
    assert response.status_code == 422
    detail = response.json().get("detail")
    assert isinstance(detail, list) and len(detail) >= 1


def test_weather_cors_header_wildcard_plus_credentials(api_client):
    response = api_client.get(
        f"{BASE_URL}/api/weather/risk",
        params={"lat": 13.15, "lon": 77.61},
        headers={"Origin": "https://example.com"},
        timeout=30,
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "*"
    assert response.headers.get("access-control-allow-credentials") == "true"
