"""Weather-driven plant disease risk (Open-Meteo, free, no key).

Risk model (rule-based estimate, NOT a diagnosis):
- Leaf-wetness proxy hour: RH >= 90%, or rain > 0.1 mm, or temp - dew point <= 2 C.
- Fungal risk: wet hours with 15-30 C (blights, leaf spots, downy mildew, rusts).
- Bacterial risk: wet hours >= 25 C plus heavy rain (splash-spread bacterial spot / blight).
- Heat & mite stress: hours >= 32 C with RH < 40% (spider mites, sun scorch, wilting).
"""
import time
from datetime import datetime
from typing import Any, Dict, List

import httpx
from fastapi import HTTPException

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_CACHE: Dict[str, Any] = {}
_CACHE_TTL = 15 * 60

LEVELS = ["low", "moderate", "high"]


# async def _get(url: str, params: dict) -> dict:
#     try:
#         async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
#             r = await client.get(url, params=params)
#             r.raise_for_status()
#             return r.json()
#     except (httpx.TimeoutException, httpx.HTTPError) as exc:
#         raise HTTPException(status_code=500, detail="Weather service unavailable, try again shortly") from exc
async def _get(url: str, params: dict) -> dict:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        import logging
        logging.error(f"Weather API error: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=500, detail=f"Weather error: {type(exc).__name__}: {str(exc)}") from exc


async def geocode(q: str) -> List[dict]:
    data = await _get(GEOCODE_URL, {"name": q, "count": 6, "language": "en", "format": "json"})
    out = []
    for x in data.get("results", []) or []:
        out.append({
            "name": x.get("name"),
            "admin1": x.get("admin1"),
            "country": x.get("country"),
            "country_code": x.get("country_code"),
            "latitude": x.get("latitude"),
            "longitude": x.get("longitude"),
            "timezone": x.get("timezone"),
        })
    return out


def _level(value: float, moderate: float, high: float) -> str:
    if value >= high:
        return "high"
    if value >= moderate:
        return "moderate"
    return "low"


def _score(value: float, cap: float) -> int:
    return int(max(0, min(100, round(value / cap * 100))))


def _assess(temps, rhs, rains, dews) -> dict:
    n = len(temps)
    wet = [
        (rhs[i] is not None and rhs[i] >= 90)
        or (rains[i] or 0) > 0.1
        or (temps[i] is not None and dews[i] is not None and temps[i] - dews[i] <= 2)
        for i in range(n)
    ]
    fungal_h = sum(1 for i in range(n) if wet[i] and temps[i] is not None and 15 <= temps[i] <= 30)
    bact_h = sum(1 for i in range(n) if wet[i] and temps[i] is not None and temps[i] >= 25)
    heat_h = sum(1 for i in range(n) if temps[i] is not None and rhs[i] is not None and temps[i] >= 32 and rhs[i] < 40)
    rain = round(sum(r or 0 for r in rains), 1)
    return {"wet_hours": sum(wet), "fungal_hours": fungal_h, "bacterial_hours": bact_h,
            "heat_hours": heat_h, "rain_mm": rain}


def compute_risk(data: dict) -> dict:
    h = data.get("hourly", {}) or {}
    times: List[str] = h.get("time", []) or []
    temps = h.get("temperature_2m", []) or []
    rhs = h.get("relative_humidity_2m", []) or []
    rains = h.get("precipitation", []) or []
    dews = h.get("dew_point_2m", []) or []
    n = min(len(times), len(temps), len(rhs), len(rains), len(dews))
    if n == 0:
        raise HTTPException(status_code=500, detail="Weather service returned no forecast")
    times, temps, rhs, rains, dews = times[:n], temps[:n], rhs[:n], rains[:n], dews[:n]

    # Only look forward from the current local hour.
    cur_time = (data.get("current") or {}).get("time", "")
    start = 0
    if cur_time:
        cur_hour = cur_time[:13]
        for i, t in enumerate(times):
            if t[:13] >= cur_hour:
                start = i
                break
    f_t, f_rh, f_r, f_d = temps[start:start + 72], rhs[start:start + 72], rains[start:start + 72], dews[start:start + 72]
    m = _assess(f_t, f_rh, f_r, f_d)
    hours = len(f_t)

    fungal_level = _level(m["fungal_hours"], 10, 24)
    bact_signal = m["bacterial_hours"] + (12 if m["rain_mm"] >= 15 else 6 if m["rain_mm"] >= 5 else 0)
    bact_level = _level(bact_signal, 8, 18)
    heat_level = _level(m["heat_hours"], 4, 12)

    risks = [
        {
            "key": "fungal",
            "label": "Fungal diseases",
            "examples": "Early & late blight, leaf spots, downy mildew, rust",
            "level": fungal_level,
            "score": _score(m["fungal_hours"], 36),
            "reason": (f"{m['fungal_hours']} of the next {hours} hours have damp leaves at 15–30°C, "
                       f"which lets fungal spores germinate.") if m["fungal_hours"] else
                      "Leaves should stay dry over the next 3 days — fungal spores struggle to germinate.",
            "advice": {
                "high": ["Spray a protective fungicide (copper or mancozeb) before the wet spell",
                         "Water at the base in the morning only — keep leaves dry",
                         "Remove spotted lower leaves and improve airflow between plants"],
                "moderate": ["Check the undersides of leaves every 2 days for new spots",
                             "Avoid overhead watering and evening irrigation",
                             "Keep a fungicide ready if humidity stays high"],
                "low": ["Conditions are unfavourable for fungi — keep normal care",
                        "Continue weekly leaf checks"],
            }[fungal_level],
        },
        {
            "key": "bacterial",
            "label": "Bacterial diseases",
            "examples": "Bacterial spot, bacterial blight, soft rot",
            "level": bact_level,
            "score": _score(bact_signal, 27),
            "reason": (f"{m['bacterial_hours']} warm & wet hours (≥25°C) and {m['rain_mm']} mm of rain expected — "
                       f"rain splash spreads bacteria between leaves.") if bact_signal else
                      "No warm, rainy spells ahead — bacteria have little chance to spread.",
            "advice": {
                "high": ["Do not work among plants while leaves are wet",
                         "Apply a copper-based bactericide before heavy rain",
                         "Mulch the soil to stop rain splashing onto leaves"],
                "moderate": ["Disinfect pruning tools between plants",
                             "Mulch around the base to reduce soil splash"],
                "low": ["Low bacterial pressure — no action needed"],
            }[bact_level],
        },
        {
            "key": "heat",
            "label": "Heat & mite stress",
            "examples": "Spider mites, leaf scorch, wilting",
            "level": heat_level,
            "score": _score(m["heat_hours"], 18),
            "reason": (f"{m['heat_hours']} hot, dry hours (≥32°C, humidity under 40%) ahead — "
                       f"mites multiply fast and leaves can scorch.") if m["heat_hours"] else
                      "No hot, dry spells expected over the next 3 days.",
            "advice": {
                "high": ["Water deeply early in the morning",
                         "Provide shade cloth for young or potted plants",
                         "Spray leaf undersides with water or neem oil to deter mites"],
                "moderate": ["Check leaf undersides for fine webbing or speckling",
                             "Mulch to keep roots cool and soil moist"],
                "low": ["No heat stress expected"],
            }[heat_level],
        },
    ]
    overall = max((r["level"] for r in risks), key=LEVELS.index)
    top = max(risks, key=lambda r: (LEVELS.index(r["level"]), r["score"]))

    # Daily outlook (local calendar days)
    days: Dict[str, Dict[str, list]] = {}
    for i in range(n):
        d = times[i][:10]
        b = days.setdefault(d, {"t": [], "rh": [], "r": [], "dw": []})
        b["t"].append(temps[i]); b["rh"].append(rhs[i]); b["r"].append(rains[i]); b["dw"].append(dews[i])
    daily = []
    for d, b in list(days.items())[:3]:
        dm = _assess(b["t"], b["rh"], b["r"], b["dw"])
        valid_t = [t for t in b["t"] if t is not None]
        valid_rh = [x for x in b["rh"] if x is not None]
        daily.append({
            "date": d,
            "weekday": datetime.fromisoformat(d).strftime("%a"),
            "temp_min": round(min(valid_t), 1) if valid_t else None,
            "temp_max": round(max(valid_t), 1) if valid_t else None,
            "humidity_avg": round(sum(valid_rh) / len(valid_rh)) if valid_rh else None,
            "rain_mm": dm["rain_mm"],
            "fungal_level": _level(dm["fungal_hours"], 4, 10),
        })

    cur = data.get("current") or {}
    if overall == "high":
        headline = f"High {top['label'].lower().replace('diseases', 'disease')} risk in the next 3 days"
    elif overall == "moderate":
        headline = f"Moderate {top['label'].lower().replace('diseases', 'disease')} risk — stay watchful"
    else:
        headline = "Low disease risk — good growing weather"

    return {
        "current": {
            "time": cur.get("time"),
            "temperature": cur.get("temperature_2m"),
            "humidity": cur.get("relative_humidity_2m"),
            "precipitation": cur.get("precipitation"),
            "wind_speed": cur.get("wind_speed_10m"),
            "weather_code": cur.get("weather_code"),
            "is_day": cur.get("is_day"),
        },
        "overall_level": overall,
        "headline": headline,
        "risks": risks,
        "daily": daily,
        "metrics": {**m, "hours": hours},
        "timezone": data.get("timezone"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "source": "Open-Meteo",
        "disclaimer": "Rule-based estimate from forecast weather — not a diagnosis.",
    }


async def disease_risk(lat: float, lon: float) -> dict:
    key = f"{round(lat, 2)}:{round(lon, 2)}"
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < _CACHE_TTL:
        return hit[1]
    data = await _get(FORECAST_URL, {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day",
        "hourly": "temperature_2m,relative_humidity_2m,precipitation,dew_point_2m",
        "forecast_days": 4,
        "timezone": "auto",
    })
    result = compute_risk(data)
    _CACHE[key] = (time.time(), result)
    if len(_CACHE) > 500:
        _CACHE.clear()
    return result
