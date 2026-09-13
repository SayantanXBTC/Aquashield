"""Builds shared/constants/towns/<city_id>.json — real coastline + real
building footprints for a curated Indian coastal city (architecture.md
ADR-009). One-time/rerunnable developer tool, run manually with network
access; the running app never fetches Natural Earth or Overpass itself.

    .venv/bin/python scripts/build_town_data.py chennai

Pipeline per city:
  1. Fetch Natural Earth's 10m coastline, clip to a bbox around the city.
  2. Resample to evenly-spaced points, project to a local km frame (the
     SAME 300 km square shape/range PropagationConfig already validates
     against — a city's real coastline just occupies a different-looking
     curve inside it, not a differently-sized world).
  3. Fit shore_base_x_km + 3 sine terms to that curve via least squares —
     the exact parametric shape simulation/core/propagation.py's shore_x
     and frontend/src/three/world/demoWorld.ts's terrainHeightKm/GLSL twin
     already expect, so no physics/rendering consumer needs a rewrite.
  4. Fetch OSM building footprints (Overpass) in the same bbox, derive a
     generic class/type/height, project to the same local frame.
  5. Write the committed TownProfile JSON (shared/types/index.ts).

No real lat/lon reaches the committed output or the running app — only this
script ever sees it. No individual building/landmark name is ever recorded:
TownPlacement carries only a generic StructureType.
"""

from __future__ import annotations

import json
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import httpx
import numpy as np
from scipy.optimize import curve_fit
from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge, unary_union

REPO_ROOT = Path(__file__).resolve().parents[1]
TOWNS_DIR = REPO_ROOT / "shared" / "constants" / "towns"

NATURAL_EARTH_10M_COASTLINE_URL = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_coastline.zip"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

WORLD_KM = 300.0  # must equal simulation/core/propagation.py's WORLD_KM
KM_PER_DEG_LAT = 110.574
DEG_TO_RAD = np.pi / 180.0

# Existing procedural CLASS_SCALE ranges (frontend/src/three/urban/buildingPlacement.ts)
# — reused so real and fictional buildings render at the same visual scale
# (an artistic exaggeration, same convention as the rest of the 3D world;
# not literal metres).
CLASS_SCALE = {"low": (1.0, 1.8), "mid": (2.2, 3.4), "highrise": (4.0, 7.5)}

# OSM building/amenity tag -> the existing generic StructureType
# (shared/types/index.ts). Never a real name — only these six values.
_TYPE_MAP = {
    "hospital": "hospital",
    "clinic": "hospital",
    "power": "power_plant",
    "lighthouse": "lighthouse",
    "fuel": "fuel_terminal",
    "port": "port",
    "ferry_terminal": "port",
}


@dataclass(frozen=True)
class CityDef:
    city_id: str
    label: str
    center_lat: float
    center_lon: float
    bbox_km: float  # half-extent of the fetch/render bbox around center, km
    ocean_side: str  # "east" | "west" — which real compass side the ocean is on
    heading_deg: float  # a hazard's default travel direction toward this coast


# Phase 1 validates against Chennai only (CLAUDE.md ADR-009 / the approved
# plan) before the other four are attempted — a straight-ish coastline is
# the best first candidate for the 3-term sine fit. Mumbai/Puri/Vizag/Kochi
# are commented in with real, verifiable centers so a follow-up run only
# needs the CLI arg, not new research — but are not yet validated.
CITIES: dict[str, CityDef] = {
    "chennai": CityDef("chennai", "Chennai, Tamil Nadu", 13.0827, 80.2707, 15.0, "east", 270.0),
    # "mumbai": CityDef("mumbai", "Mumbai, Maharashtra", 18.9750, 72.8258, 15.0, "west", 90.0),
    # "puri": CityDef("puri", "Puri, Odisha", 19.8135, 85.8312, 15.0, "east", 270.0),
    # "visakhapatnam": CityDef("visakhapatnam", "Visakhapatnam, Andhra Pradesh", 17.6868, 83.2185, 15.0, "east", 270.0),
    # "kochi": CityDef("kochi", "Kochi, Kerala", 9.9312, 76.2673, 15.0, "west", 90.0),
}


def km_per_deg_lon(lat_deg: float) -> float:
    return KM_PER_DEG_LAT * np.cos(lat_deg * DEG_TO_RAD)


def to_local_km(lat: float, lon: float, city: CityDef) -> tuple[float, float]:
    """Real (lat, lon) -> local (xKm, yKm) inside the standard 300km world,
    city center at (150, 150). Cross-shore axis is mirrored for an
    east-facing coast so "land is x > shore_x" holds regardless of which
    real compass direction the ocean is actually on (CLAUDE.md §26's land/
    sea convention is fixed; only this projection step needs to know the
    city's real facing)."""
    dx_km = (lon - city.center_lon) * km_per_deg_lon(city.center_lat)
    dy_km = (lat - city.center_lat) * KM_PER_DEG_LAT
    if city.ocean_side == "east":
        dx_km = -dx_km
    return dx_km + WORLD_KM / 2, dy_km + WORLD_KM / 2


def fetch_coastline(city: CityDef) -> LineString:
    print(f"[{city.city_id}] fetching Natural Earth 10m coastline...")
    resp = httpx.get(NATURAL_EARTH_10M_COASTLINE_URL, timeout=60, follow_redirects=True)
    resp.raise_for_status()
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = Path(tmp) / "ne_10m_coastline.zip"
        zip_path.write_bytes(resp.content)
        if not zipfile.is_zipfile(zip_path):
            raise RuntimeError("Natural Earth response was not a zip file")
        import geopandas as gpd

        gdf = gpd.read_file(f"zip://{zip_path}")
    if gdf.crs is not None and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    deg_margin = city.bbox_km / KM_PER_DEG_LAT * 1.4
    bbox = (city.center_lon - deg_margin, city.center_lat - deg_margin, city.center_lon + deg_margin, city.center_lat + deg_margin)
    clipped = gdf.clip(bbox)
    if clipped.empty:
        raise RuntimeError(f"No coastline geometry found within {city.bbox_km}km of {city.city_id}")
    union = unary_union(clipped.geometry.tolist())
    merged = linemerge(union) if union.geom_type == "MultiLineString" else union
    if merged.geom_type == "MultiLineString":
        merged = max(merged.geoms, key=lambda g: g.length)
    return merged


def resample_and_project(line: LineString, city: CityDef, n: int = 200) -> np.ndarray:
    distances = np.linspace(0, line.length, n)
    points = [line.interpolate(d) for d in distances]
    local = np.array([to_local_km(p.y, p.x, city) for p in points])
    # Keep only points inside the city's local render bbox.
    mask = (np.abs(local[:, 1] - WORLD_KM / 2) < city.bbox_km) & (np.abs(local[:, 0] - WORLD_KM / 2) < city.bbox_km * 1.5)
    return local[mask]


def _shore_model(y, base, a0, f0, p0, a1, f1, p1, a2, f2, p2):
    x = base
    for amp, freq, phase in ((a0, f0, p0), (a1, f1, p1), (a2, f2, p2)):
        x = x + amp * np.sin(2.0 * np.pi * freq * y / WORLD_KM + phase)
    return x


def fit_shore(points: np.ndarray) -> tuple[float, tuple, float]:
    y, x = points[:, 1], points[:, 0]
    base_guess = float(np.mean(x))
    # Deliberately low frequency bounds — approximate general curvature,
    # never trace every real inlet (a real coastline is far noisier than
    # the demo world's smooth analytic one).
    p0 = [base_guess, 5.0, 1.0, 0.6, 3.0, 2.0, 2.1, 1.5, 2.9, 4.0]
    bounds_lo = [base_guess - 40, -20, 0.1, -10, -20, 0.1, -10, -20, 0.1, -10]
    bounds_hi = [base_guess + 40, 20, 3.0, 10, 20, 3.0, 10, 20, 3.0, 10]
    try:
        popt, _ = curve_fit(_shore_model, y, x, p0=p0, bounds=(bounds_lo, bounds_hi), maxfev=20000)
    except RuntimeError as exc:
        raise RuntimeError(f"Shoreline curve fit failed to converge: {exc}") from exc
    fitted = _shore_model(y, *popt)
    rmse = float(np.sqrt(np.mean((fitted - x) ** 2)))
    base, a0, f0, p0_, a1, f1, p1, a2, f2, p2 = popt
    terms = ((float(a0), float(f0), float(p0_)), (float(a1), float(f1), float(p1)), (float(a2), float(f2), float(p2)))
    return float(base), terms, rmse


def fetch_buildings(city: CityDef) -> list[dict]:
    print(f"[{city.city_id}] fetching OSM building footprints...")
    deg_margin = city.bbox_km / KM_PER_DEG_LAT
    south, west = city.center_lat - deg_margin, city.center_lon - deg_margin
    north, east = city.center_lat + deg_margin, city.center_lon + deg_margin
    query = f'[out:json][timeout:90];way["building"]({south},{west},{north},{east});out geom tags;'
    resp = httpx.get(OVERPASS_URL, params={"data": query}, timeout=120, headers={"Accept": "*/*", "User-Agent": "aquashield-build-town-data/1.0"})
    resp.raise_for_status()
    return resp.json().get("elements", [])


def classify(height_m: float | None, tags: dict) -> tuple[str, str]:
    stype = "building"
    for tag_key in ("amenity", "building"):
        val = tags.get(tag_key, "")
        if val in _TYPE_MAP:
            stype = _TYPE_MAP[val]
            break
    if height_m is None:
        levels = tags.get("building:levels")
        try:
            height_m = float(levels) * 3.2 if levels else None
        except (TypeError, ValueError):
            height_m = None
        if height_m is None:
            height_m = {"house": 6.0, "residential": 10.0}.get(tags.get("building", ""), 8.0)
    cls = "low" if height_m < 15 else "mid" if height_m < 40 else "highrise"
    return cls, stype


def buildings_to_placements(elements: list[dict], city: CityDef, cap_per_class: int = 700) -> list[dict]:
    by_class: dict[str, list[dict]] = {"low": [], "mid": [], "highrise": []}
    for el in elements:
        geom = el.get("geometry")
        tags = el.get("tags", {})
        if not geom or len(geom) < 3:
            continue
        coords = [(pt["lon"], pt["lat"]) for pt in geom]
        try:
            poly = Polygon(coords)
        except Exception:
            continue
        if not poly.is_valid or poly.area == 0:
            continue
        centroid = poly.centroid
        x_km, y_km = to_local_km(centroid.y, centroid.x, city)
        try:
            height_m = float(tags["height"]) if "height" in tags else None
        except (TypeError, ValueError):
            height_m = None
        cls, stype = classify(height_m, tags)
        lo, hi = CLASS_SCALE[cls]
        # Real footprint orientation (long axis of the min rotated rect),
        # not random — the one thing distinguishing this from the fictional
        # procedural layer.
        try:
            rect = poly.minimum_rotated_rectangle
            rx, ry = rect.exterior.coords[0], rect.exterior.coords[1]
            rot_y = float(np.arctan2(ry[0] - rx[0], ry[1] - rx[1]))
            if not np.isfinite(rot_y):
                rot_y = 0.0
        except Exception:
            rot_y = 0.0
        seed = abs(hash((round(x_km, 3), round(y_km, 3)))) % 1000 / 1000.0
        by_class[cls].append(
            {"xKm": round(x_km, 3), "yKm": round(y_km, 3), "cls": cls, "scale": round(lo + seed * (hi - lo), 3), "rotY": round(rot_y, 4), "type": stype}
        )

    out: list[dict] = []
    for cls, items in by_class.items():
        if len(items) > cap_per_class:
            stride = len(items) / cap_per_class
            items = [items[int(i * stride)] for i in range(cap_per_class)]
        out.extend(items)
    return out


def build_city(city_id: str) -> None:
    city = CITIES[city_id]
    coastline = fetch_coastline(city)
    points = resample_and_project(coastline, city)
    if len(points) < 20:
        raise RuntimeError(f"Only {len(points)} usable coastline points for {city_id} — widen bbox_km or check center coords")
    base_x_km, terms, rmse = fit_shore(points)
    print(f"[{city_id}] shore fit rmse={rmse:.2f}km over {len(points)} points")

    elements = fetch_buildings(city)
    placements = buildings_to_placements(elements, city)
    print(f"[{city_id}] {len(placements)} building placements from {len(elements)} OSM ways")

    profile = {
        "city_id": city.city_id,
        "label": city.label,
        "shore_base_x_km": round(base_x_km, 3),
        "shore_terms": [{"amp": round(a, 4), "freq": round(f, 4), "phase": round(p, 4)} for a, f, p in terms],
        "heading_deg": city.heading_deg,
        "buildings": placements,
        "fit_quality": {"rmse_km": round(rmse, 3), "sample_count": len(points)},
        "data_provenance": {
            "coastline_source": "Natural Earth 10m coastline (naturalearthdata.com)",
            "buildings_source": "OpenStreetMap via Overpass API, (c) OpenStreetMap contributors, ODbL",
            "generated_by": "scripts/build_town_data.py",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }
    TOWNS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = TOWNS_DIR / f"{city_id}.json"
    out_path.write_text(json.dumps(profile, indent=2) + "\n", encoding="utf-8")
    print(f"[{city_id}] wrote {out_path}")


if __name__ == "__main__":
    ids = sys.argv[1:] or list(CITIES)
    for cid in ids:
        if cid not in CITIES:
            print(f"Unknown or not-yet-defined city_id={cid!r}. Known: {list(CITIES)}", file=sys.stderr)
            sys.exit(1)
    for cid in ids:
        build_city(cid)
