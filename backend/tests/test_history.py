"""Backend tests for /api/history endpoints (Verdaleaf).

Requires the demo seed to be present (run /app/scripts/seed_demo_history.py).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://codebase-reader-21.preview.emergentagent.com").rstrip("/")
TOKEN = "qa-demo-session-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


# ---------- Auth guards ----------
def test_history_requires_auth():
    r = requests.get(f"{BASE_URL}/api/history")
    assert r.status_code == 401


def test_history_stats_requires_auth():
    r = requests.get(f"{BASE_URL}/api/history/stats")
    assert r.status_code == 401


# ---------- Listing / filtering / paging ----------
def test_history_default_returns_total_8():
    r = requests.get(f"{BASE_URL}/api/history", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "total" in body
    assert body["total"] == 8
    assert len(body["items"]) == 8
    # newest-first
    dates = [i["created_at"] for i in body["items"]]
    assert dates == sorted(dates, reverse=True)


def test_history_status_healthy():
    r = requests.get(f"{BASE_URL}/api/history?status=healthy", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    assert all(i["is_healthy"] is True for i in body["items"])


def test_history_status_diseased():
    r = requests.get(f"{BASE_URL}/api/history?status=diseased", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 6
    assert all(i["is_healthy"] is False for i in body["items"])


def test_history_search_blight():
    r = requests.get(f"{BASE_URL}/api/history?q=blight", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2
    names = {i["disease_name"] for i in body["items"]}
    assert "Early Blight" in names and "Late Blight" in names


def test_history_pagination_no_overlap():
    p1 = requests.get(f"{BASE_URL}/api/history?limit=3&skip=0", headers=AUTH).json()
    p2 = requests.get(f"{BASE_URL}/api/history?limit=3&skip=3", headers=AUTH).json()
    assert len(p1["items"]) == 3
    assert len(p2["items"]) == 3
    ids1 = {i["id"] for i in p1["items"]}
    ids2 = {i["id"] for i in p2["items"]}
    assert ids1.isdisjoint(ids2)
    assert p1["total"] == 8 and p2["total"] == 8


def test_history_limit_clamped_to_60():
    r = requests.get(f"{BASE_URL}/api/history?limit=500", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    # only 8 exist but the clamp shouldn't error out
    assert len(body["items"]) <= 60


# ---------- Stats ----------
def test_history_stats_numbers():
    r = requests.get(f"{BASE_URL}/api/history/stats", headers=AUTH)
    assert r.status_code == 200
    s = r.json()
    assert s["total"] == 8
    assert s["healthy"] == 2
    assert s["diseased"] == 6
    assert s["severe"] == 3
    assert s["plants_tracked"] == 7
    for key in ("top_issue", "top_issue_count", "top_plant", "last_scan_at"):
        assert key in s


# ---------- Delete cross-user protection ----------
def test_delete_nonexistent_or_foreign_returns_zero():
    r = requests.delete(f"{BASE_URL}/api/history/det_does_not_exist_xyz", headers=AUTH)
    assert r.status_code == 200
    assert r.json() == {"deleted": 0}


def test_delete_requires_auth():
    r = requests.delete(f"{BASE_URL}/api/history/anything")
    assert r.status_code == 401
