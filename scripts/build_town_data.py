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
     already expect, so no physics/rendering consumer needs a rewrite. This
     single-valued x=f(y) curve is a FAR-FIELD FALLBACK ONLY — it cannot
     express a peninsula (Mumbai) or islands/lagoons (Kochi).
  4. Fetch OSM building footprints (Overpass) in the same bbox, derive a
     generic class/type/height, project to the same local frame.
  5. Fetch Natural Earth's 10m LAND POLYGONS (not just the coastline lines),
     project into the same local km frame, and rasterise a signed distance
     field (`land_field`): positive = inland, negative = offshore, sampled
     on a uniform grid sized to cover the city's real building footprint.
     This is the authoritative land/sea test consumers should prefer; the
     sine curve remains the fallback outside the field's footprint.
  6. Write the committed TownProfile JSON (shared/types/index.ts).

No real lat/lon reaches the committed output or the running app — only this
script ever sees it. No individual building/landmark name is ever recorded:
TownPlacement carries only a generic StructureType.

Natural Earth 10m is a coarse global dataset (roughly 100m-1km positional
accuracy) — good enough to place buildings on the correct side of the coast
and to shape a demo world, but not survey-grade, and must never be presented
as such.
"""

from __future__ import annotations

import base64
import json
import sys
import tempfile
import time
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import httpx
import numpy as np
import shapely.vectorized
from scipy import ndimage
from scipy.optimize import curve_fit
from shapely.geometry import LineString, Polygon
from shapely.ops import linemerge, transform as shp_transform, unary_union

REPO_ROOT = Path(__file__).resolve().parents[1]
TOWNS_DIR = REPO_ROOT / "shared" / "constants" / "towns"

NATURAL_EARTH_10M_COASTLINE_URL = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_coastline.zip"
NATURAL_EARTH_10M_LAND_URL = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_land.zip"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
)

WORLD_KM = 300.0  # must equal simulation/core/propagation.py's WORLD_KM
# Above this share of footprints landing seaward of the shoreline, the data
# is not describing the coast well enough to ship (ADR-009's per-city
# fit-quality validation). Judged against `land_field` wherever a building
# falls inside its footprint; the 3-term sine fit is the fallback test only
# for the (normally empty) remainder outside the field's coverage.
MAX_OFFSHORE_FRACTION = 0.02
KM_PER_DEG_LAT = 110.574
DEG_TO_RAD = np.pi / 180.0

# `land_field` grid parameters (CLAUDE.md contract — three independent
# readers sample this exact shape/convention; do not change without
# updating all of them). 256x256 at up to ~50km field size gives sub-200m
# cells — finer than Natural Earth 10m's own positional accuracy, so this
# is not a meaningful precision bottleneck. scale_km=0.01 (10m) keeps
# int16-quantized depth values well inside range for any city-sized field.
LAND_FIELD_RESOLUTION = 256
LAND_FIELD_SCALE_KM = 0.01
LAND_FIELD_PAD_FRACTION = 0.25  # pad the building bbox by ~25% before squaring it

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


# All five cities are validated by `land_field` (a real rasterised signed
# distance field, see build_land_field below) rather than the 3-term sine
# fit alone — the sine fit is a poor structural match for a peninsula
# (Mumbai) or islands/lagoons (Kochi) and is kept only as a far-field
# fallback outside the land_field's footprint.
CITIES: dict[str, CityDef] = {
    "chennai": CityDef("chennai", "Chennai, Tamil Nadu", 13.0827, 80.2707, 15.0, "east", 270.0),
    "mumbai": CityDef("mumbai", "Mumbai, Maharashtra", 18.9750, 72.8258, 15.0, "west", 90.0),
    "puri": CityDef("puri", "Puri, Odisha", 19.8135, 85.8312, 15.0, "east", 270.0),
    "visakhapatnam": CityDef("visakhapatnam", "Visakhapatnam, Andhra Pradesh", 17.6868, 83.2185, 15.0, "east", 270.0),
    "kochi": CityDef("kochi", "Kochi, Kerala", 9.9312, 76.2673, 15.0, "west", 90.0),
}


def km_per_deg_lon(lat_deg: float) -> float:
    return KM_PER_DEG_LAT * np.cos(lat_deg * DEG_TO_RAD)


def to_local_km(lat: float, lon: float, city: CityDef) -> tuple[float, float]:
    """Real lat/lon to the synthetic km frame, city centre at (150, 150).
    The cross-shore axis is NOT mirrored: orientation is carried by the
    emitted `ocean_side` field and applied as ShoreParams.land_sign, so an
    east-facing city keeps its real chirality."""
    dx_km = (lon - city.center_lon) * km_per_deg_lon(city.center_lat)
    dy_km = (lat - city.center_lat) * KM_PER_DEG_LAT
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


def fetch_land_polygons(city: CityDef):
    """Natural Earth 10m LAND polygons (not just the coastline line) — the
    `land_field` needs to know which side of the coast is land, which a
    bare LineString cannot answer for a peninsula or an island."""
    print(f"[{city.city_id}] fetching Natural Earth 10m land polygons...")
    resp = httpx.get(NATURAL_EARTH_10M_LAND_URL, timeout=60, follow_redirects=True)
    resp.raise_for_status()
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = Path(tmp) / "ne_10m_land.zip"
        zip_path.write_bytes(resp.content)
        if not zipfile.is_zipfile(zip_path):
            raise RuntimeError("Natural Earth land response was not a zip file")
        import geopandas as gpd

        gdf = gpd.read_file(f"zip://{zip_path}")
    if gdf.crs is not None and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    deg_margin = city.bbox_km / KM_PER_DEG_LAT * 1.4
    bbox = (city.center_lon - deg_margin, city.center_lat - deg_margin, city.center_lon + deg_margin, city.center_lat + deg_margin)
    clipped = gdf.clip(bbox)
    if clipped.empty:
        raise RuntimeError(f"No land polygon geometry found within {city.bbox_km}km of {city.city_id}")
    return unary_union(clipped.geometry.tolist())


def project_geom_to_km(geom, city: CityDef):
    """Vectorised twin of to_local_km, applied to every vertex of a
    (Multi)Polygon at once via shapely.ops.transform — same formula, same
    frame, just batched for a whole geometry instead of one point."""

    def _fn(lon, lat):
        lon_arr = np.asarray(lon, dtype=float)
        lat_arr = np.asarray(lat, dtype=float)
        dx = (lon_arr - city.center_lon) * km_per_deg_lon(city.center_lat) + WORLD_KM / 2.0
        dy = (lat_arr - city.center_lat) * KM_PER_DEG_LAT + WORLD_KM / 2.0
        return dx, dy

    return shp_transform(_fn, geom)


def compute_field_footprint(bbox_km: tuple[float, float, float, float], world_km: float = WORLD_KM, pad_fraction: float = LAND_FIELD_PAD_FRACTION) -> tuple[float, float, float]:
    """City building bbox -> a square (origin_x_km, origin_y_km, size_km)
    for the land_field, padded by ~25% and clamped inside the 300km world."""
    minx, maxx, miny, maxy = bbox_km
    width, height = maxx - minx, maxy - miny
    cx, cy = (minx + maxx) / 2.0, (miny + maxy) / 2.0
    half = max(width, height, 1.0) / 2.0 * (1.0 + pad_fraction)
    half = min(half, world_km / 2.0)
    size = half * 2.0
    origin_x = min(max(cx - half, 0.0), world_km - size)
    origin_y = min(max(cy - half, 0.0), world_km - size)
    return origin_x, origin_y, size


def build_land_field(
    land_geom_km,
    origin_x_km: float,
    origin_y_km: float,
    size_km: float,
    resolution: int = LAND_FIELD_RESOLUTION,
    scale_km: float = LAND_FIELD_SCALE_KM,
) -> tuple[dict, np.ndarray]:
    """Rasterise a signed distance field from real land geometry (already in
    local km): positive = inland depth, negative = offshore distance.

    Efficient two-pass approach (naive per-cell shapely distance queries
    would be 65536 point-in-polygon + distance calls per city and slow):
      1. Rasterise inside/outside once via shapely.vectorized.contains
         (GEOS prepared-geometry contains test, vectorised over the grid).
      2. scipy.ndimage.distance_transform_edt on that binary raster gives
         the Euclidean distance (in cells) from every cell to the nearest
         opposite-class cell, on both sides, in one pass each.

    Returns (land_field JSON dict, signed_km float grid) — the float grid
    is reused directly by the offshore fit-quality gate so that gate is not
    degraded by the int16 quantization applied only for the shipped JSON.
    """
    cell_km = size_km / resolution
    xs = origin_x_km + (np.arange(resolution) + 0.5) * cell_km
    ys = origin_y_km + (np.arange(resolution) + 0.5) * cell_km
    xx, yy = np.meshgrid(xs, ys)  # xx varies along columns (x fastest), yy along rows (y)

    if land_geom_km.is_empty:
        land_mask = np.zeros((resolution, resolution), dtype=bool)
    else:
        land_mask = shapely.vectorized.contains(land_geom_km, xx, yy)

    # distance_transform_edt(mask) = distance (in cells) from each True cell
    # to the nearest False cell; 0 at every False cell. Doing it once on the
    # mask and once on its complement gives both the land-side depth and the
    # sea-side distance in two cheap passes.
    inland_depth_km = ndimage.distance_transform_edt(land_mask) * cell_km
    offshore_dist_km = ndimage.distance_transform_edt(~land_mask) * cell_km
    signed_km = inland_depth_km - offshore_dist_km  # + inland, - offshore

    quantized = np.clip(np.round(signed_km / scale_km), -32768, 32767).astype("<i2")
    data_b64 = base64.b64encode(quantized.tobytes(order="C")).decode("ascii")
    land_field = {
        "origin_x_km": round(origin_x_km, 3),
        "origin_y_km": round(origin_y_km, 3),
        "size_km": round(size_km, 3),
        "resolution": resolution,
        "scale_km": scale_km,
        "data": data_b64,
    }
    return land_field, signed_km


def sample_signed_km(signed_km_grid: np.ndarray, origin_x_km: float, origin_y_km: float, size_km: float, resolution: int, x_km: float, y_km: float) -> float | None:
    """Nearest-neighbour sample, identical convention to the contract all
    three consumer languages implement. None = outside the field footprint."""
    u = (x_km - origin_x_km) / size_km
    v = (y_km - origin_y_km) / size_km
    if u < 0 or u >= 1 or v < 0 or v >= 1:
        return None
    col = min(max(int(u * resolution), 0), resolution - 1)
    row = min(max(int(v * resolution), 0), resolution - 1)
    return float(signed_km_grid[row, col])


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
    query = f'[out:json][timeout:180];way["building"]({south},{west},{north},{east});out geom tags;'
    headers = {"Accept": "*/*", "User-Agent": "aquashield-build-town-data/1.0"}
    # Overpass mirrors rate-limit and time out under load; rotate and retry
    # rather than losing a whole multi-city run to one 504.
    last: Exception | None = None
    for attempt, endpoint in enumerate(OVERPASS_ENDPOINTS * 3):
        try:
            resp = httpx.get(endpoint, params={"data": query}, timeout=300, headers=headers)
            resp.raise_for_status()
            payload = resp.json()
            # Overpass signals a timed-out or truncated query with HTTP 200, a
            # `remark` field and few or no elements. Taken at face value that
            # silently yields an empty city and a degenerate bbox, so treat it
            # as a failure and move to the next mirror.
            remark = payload.get("remark")
            elements = payload.get("elements", [])
            if remark and not elements:
                raise RuntimeError(f"Overpass returned no elements with remark: {remark}")
            if remark:
                print(f"[{city.city_id}]   Overpass remark (partial result): {remark}", file=sys.stderr)
            if not elements:
                raise RuntimeError("Overpass returned zero building ways")
            return elements
        except Exception as exc:  # noqa: BLE001 - any transport/status failure is retryable here
            last = exc
            print(f"[{city.city_id}]   {endpoint.split('/')[2]} failed ({type(exc).__name__}); retrying", file=sys.stderr)
            time.sleep(5 + 5 * attempt)
    raise RuntimeError(f"All Overpass endpoints failed for {city.city_id}") from last


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


def buildings_to_placements(
    elements: list[dict], city: CityDef, cap_per_class: int = 6000
) -> tuple[list[dict], int, tuple[float, float, float, float]]:
    """Returns (placements, pre-cap total count, (minx, maxx, miny, maxy) bbox
    of ALL real footprints before capping — the cap must not shrink the
    footprint the land_field is sized against)."""
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

    precap_total = sum(len(items) for items in by_class.values())
    all_items = [it for items in by_class.values() for it in items]
    if all_items:
        xs = [it["xKm"] for it in all_items]
        ys = [it["yKm"] for it in all_items]
        bbox = (min(xs), max(xs), min(ys), max(ys))
    else:
        # Degenerate fallback so the caller always gets a valid square later.
        bbox = (WORLD_KM / 2 - 1.0, WORLD_KM / 2 + 1.0, WORLD_KM / 2 - 1.0, WORLD_KM / 2 + 1.0)

    out: list[dict] = []
    for cls, items in by_class.items():
        if len(items) > cap_per_class:
            # Even stride keeps spatial coverage uniform instead of clipping
            # to whatever corner Overpass happened to return first.
            stride = len(items) / cap_per_class
            items = [items[int(i * stride)] for i in range(cap_per_class)]
        out.extend(items)
    return out, precap_total, bbox


def build_city(city_id: str) -> None:
    city = CITIES[city_id]
    coastline = fetch_coastline(city)
    points = resample_and_project(coastline, city)
    if len(points) < 20:
        raise RuntimeError(f"Only {len(points)} usable coastline points for {city_id} — widen bbox_km or check center coords")
    base_x_km, terms, rmse = fit_shore(points)
    print(f"[{city_id}] shore fit rmse={rmse:.2f}km over {len(points)} points")

    elements = fetch_buildings(city)
    placements, precap_total, bldg_bbox = buildings_to_placements(elements, city)
    print(f"[{city_id}] {len(placements)} building placements kept from {precap_total} real footprints ({len(elements)} OSM ways received)")

    # Real land geometry -> a rasterised signed distance field sized to
    # generously cover the real building footprint (the authoritative
    # land/sea test; the 3-term sine above is a far-field fallback only —
    # it cannot express a peninsula or islands/lagoons).
    land_polygons = fetch_land_polygons(city)
    land_polygons_km = project_geom_to_km(land_polygons, city)
    field_origin_x, field_origin_y, field_size = compute_field_footprint(bldg_bbox)
    land_field, signed_km_grid = build_land_field(land_polygons_km, field_origin_x, field_origin_y, field_size)
    print(f"[{city_id}] land_field origin=({field_origin_x:.1f},{field_origin_y:.1f})km size={field_size:.1f}km res={LAND_FIELD_RESOLUTION}")

    # A building is misplaced if the FIELD says it is in the sea; the fitted
    # sine curve is used only as a fallback for the (normally empty) set of
    # buildings that fall outside the field's own footprint. Measure it and
    # refuse to ship a city we know is wrong rather than silently guessing.
    land_sign = 1.0 if city.ocean_side == "west" else -1.0

    def _shore_at(y_km: float) -> float:
        x = base_x_km
        for amp, freq, phase in terms:
            x += amp * np.sin(2.0 * np.pi * freq * y_km / WORLD_KM + phase)
        return float(x)

    offshore_field = 0
    offshore_fallback = 0
    field_checked = 0
    for p in placements:
        depth_km = sample_signed_km(signed_km_grid, field_origin_x, field_origin_y, field_size, LAND_FIELD_RESOLUTION, p["xKm"], p["yKm"])
        if depth_km is not None:
            field_checked += 1
            if depth_km < 0:
                offshore_field += 1
        elif land_sign * (p["xKm"] - _shore_at(p["yKm"])) < 0:
            offshore_fallback += 1

    offshore_total = offshore_field + offshore_fallback
    offshore_fraction = offshore_total / len(placements) if placements else 1.0
    print(
        f"[{city_id}] offshore: {offshore_field}/{field_checked} by field, "
        f"{offshore_fallback}/{len(placements) - field_checked} by sine fallback "
        f"({offshore_fraction:.1%} total)"
    )
    if offshore_fraction > MAX_OFFSHORE_FRACTION:
        raise RuntimeError(
            f"{city_id}: {offshore_fraction:.1%} of buildings fall on the seaward side of the land_field/"
            f"fitted shoreline (limit {MAX_OFFSHORE_FRACTION:.0%}, fit rmse {rmse:.2f}km). Not writing data "
            f"that would render a city in the sea."
        )

    profile = {
        "city_id": city.city_id,
        "label": city.label,
        "shore_base_x_km": round(base_x_km, 3),
        "ocean_side": city.ocean_side,
        "shore_terms": [{"amp": round(a, 4), "freq": round(f, 4), "phase": round(p, 4)} for a, f, p in terms],
        "heading_deg": city.heading_deg,
        "land_field": land_field,
        "buildings": placements,
        "fit_quality": {
            "rmse_km": round(rmse, 3),
            "sample_count": len(points),
            "offshore_placements": offshore_total,
            "offshore_fraction": round(offshore_fraction, 4),
            "offshore_by_field": offshore_field,
            "offshore_by_sine_fallback": offshore_fallback,
            "ways_received": len(elements),
            "buildings_before_cap": precap_total,
            "placements_kept": len(placements),
        },
        "data_provenance": {
            "coastline_source": "Natural Earth 10m coastline (naturalearthdata.com)",
            "land_source": "Natural Earth 10m land polygons (naturalearthdata.com) — coarse global "
            "dataset, roughly 100m-1km positional accuracy; not survey-grade",
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
    failed: list[str] = []
    for cid in ids:
        try:
            build_city(cid)
        except Exception as exc:  # noqa: BLE001 - one city's failure must not lose the others
            print(f"[{cid}] FAILED: {exc}", file=sys.stderr)
            failed.append(cid)
    if failed:
        print(f"failed: {', '.join(failed)}", file=sys.stderr)
