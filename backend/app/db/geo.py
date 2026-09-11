"""Small helpers converting between plain (latitude, longitude) floats and
PostGIS geometry — kept here (not in schemas/ or services/) since it's a
thin persistence-layer concern, not a validation or domain-logic one."""

from typing import Any

from geoalchemy2.shape import from_shape, to_shape
from geoalchemy2.types import WKBElement
from shapely.geometry import Point, mapping, shape


def latlon_to_point(latitude: float | None, longitude: float | None) -> WKBElement | None:
    if latitude is None or longitude is None:
        return None
    return from_shape(Point(longitude, latitude), srid=4326)


def point_to_latlon(geometry: WKBElement | None) -> tuple[float, float] | None:
    if geometry is None:
        return None
    point = to_shape(geometry)
    return point.y, point.x  # (latitude, longitude)


# --- Generic geometry <-> GeoJSON helpers -----------------------------------
# Added for the geospatial/hazard-footprint work (Prompt 10): unlike
# latlon_to_point/point_to_latlon above (Point-only), these accept any
# geometry type (Polygon/LineString/MultiPolygon/...) since
# GeographicFeature/InfrastructureAsset/hazard footprints are not all points.
# Still the same from_shape/to_shape pattern already used elsewhere in this
# file and in app/db/seed.py — no new geometry library introduced.


def geojson_to_geometry(geojson: dict[str, Any], srid: int = 4326) -> WKBElement:
    """Converts a GeoJSON geometry dict (as produced by
    simulation/core/geo.py::circle_polygon or a parsed dataset feature) into a
    PostGIS-storable WKBElement. Raises shapely.errors.GeometryTypeError /
    ValueError on malformed input — never silently substitutes a fallback
    geometry."""
    return from_shape(shape(geojson), srid=srid)


def geometry_to_geojson(geometry: WKBElement | None) -> dict[str, Any] | None:
    """Inverse of geojson_to_geometry — returns a plain GeoJSON geometry dict
    for API responses, or None if no geometry is stored."""
    if geometry is None:
        return None
    return mapping(to_shape(geometry))
