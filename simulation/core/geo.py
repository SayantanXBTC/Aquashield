"""Minimal geographic math shared by every disaster model — deliberately not
Shapely/GeoPandas (CLAUDE.md §16: use only what's actually required). Plain
great-circle formulas are enough to move a point and draw an approximate
circular affected-area polygon; PostGIS remains the source of truth for
persistent geospatial application data (architecture.md §14a)."""

from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points, in kilometers."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def move_point(lat: float, lon: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    """Destination point given a start point, bearing, and great-circle distance."""
    if distance_km <= 0:
        return lat, lon
    delta = distance_km / EARTH_RADIUS_KM
    theta = math.radians(bearing_deg)
    phi1, lambda1 = math.radians(lat), math.radians(lon)
    phi2 = math.asin(
        math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    )
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2),
    )
    return math.degrees(phi2), (math.degrees(lambda2) + 540) % 360 - 180


def circle_polygon(lat: float, lon: float, radius_km: float, num_points: int = 16) -> dict:
    """Approximate GeoJSON Polygon for a circle of `radius_km` around (lat, lon).
    A render-ready approximation for demo visualization — not a PostGIS query
    result. Returns a Point if radius_km <= 0."""
    if radius_km <= 0:
        return {"type": "Point", "coordinates": [lon, lat]}
    coords = []
    for i in range(num_points + 1):
        bearing = 360.0 * i / num_points
        plat, plon = move_point(lat, lon, bearing, radius_km)
        coords.append([plon, plat])
    return {"type": "Polygon", "coordinates": [coords]}
