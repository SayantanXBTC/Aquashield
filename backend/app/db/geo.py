"""Small helpers converting between plain (latitude, longitude) floats and
PostGIS geometry — kept here (not in schemas/ or services/) since it's a
thin persistence-layer concern, not a validation or domain-logic one."""

from geoalchemy2.shape import from_shape, to_shape
from geoalchemy2.types import WKBElement
from shapely.geometry import Point


def latlon_to_point(latitude: float | None, longitude: float | None) -> WKBElement | None:
    if latitude is None or longitude is None:
        return None
    return from_shape(Point(longitude, latitude), srid=4326)


def point_to_latlon(geometry: WKBElement | None) -> tuple[float, float] | None:
    if geometry is None:
        return None
    point = to_shape(geometry)
    return point.y, point.x  # (latitude, longitude)
