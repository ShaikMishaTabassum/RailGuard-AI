import hashlib, random
from datetime import datetime
from fastapi import APIRouter, Query
from stations_data import INDIAN_STATIONS

router = APIRouter()
CUSTOM_STATIONS = {}
LAT_MIN, LAT_MAX = 8.0, 37.0
LON_MIN, LON_MAX = 68.0, 97.0

def lat_lon_to_svg(lat, lon):
    x = 40 + (lon - LON_MIN) / (LON_MAX - LON_MIN) * 480
    y = 40 + (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * 420
    return round(x, 1), round(y, 1)

def find_station(query):
    key = query.strip().upper()
    if key in INDIAN_STATIONS: return key, INDIAN_STATIONS[key]
    if key in CUSTOM_STATIONS: return key, CUSTOM_STATIONS[key]
    for code, data in {**INDIAN_STATIONS, **CUSTOM_STATIONS}.items():
        if key in data["name"].upper(): return code, data
    return None, None

def get_track_condition(query):
    code, station = find_station(query)
    seed_key = code or query.strip().upper()
    rng = random.Random(int(hashlib.md5(seed_key.encode()).hexdigest(), 16))
    risk_score = round(rng.uniform(2, 35), 1)
    if rng.random() < 0.15: risk_score = round(rng.uniform(60, 95), 1)
    status = "CRITICAL" if risk_score >= 65 else "WARNING" if risk_score >= 30 else "SAFE"
    if station:
        name, lat, lon, zone = station["name"], station["lat"], station["lon"], station["zone"]
    else:
        name = query.strip().title()
        rng2 = random.Random(int(hashlib.md5((seed_key+"geo").encode()).hexdigest(), 16))
        lat = round(rng2.uniform(10, 35), 4)
        lon = round(rng2.uniform(70, 95), 4)
        zone = "UNKNOWN"
        code = seed_key[:6]
    svg_x, svg_y = lat_lon_to_svg(lat, lon)
    return {
        "station_code": code, "station_name": name,
        "lat": lat, "lon": lon, "svg_x": svg_x, "svg_y": svg_y,
        "zone": zone, "risk_score": risk_score, "status": status,
        "metrics": {
            "vibration_mm_s": round(rng.uniform(0.1, 2.5), 2),
            "rail_temperature_c": round(rng.uniform(24, 62), 1),
            "rail_wear_percent": round(rng.uniform(5, 40), 1),
        },
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }

@router.get("/track-condition")
async def track_condition(station: str = Query(..., min_length=2)):
    return get_track_condition(station)

@router.get("/stations")
async def list_stations():
    result = []
    for code, d in {**INDIAN_STATIONS, **CUSTOM_STATIONS}.items():
        x, y = lat_lon_to_svg(d["lat"], d["lon"])
        result.append({"code": code, "svg_x": x, "svg_y": y, **d})
    return result
