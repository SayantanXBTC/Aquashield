"""Geometry intersection tests for app/services/exposure_service.py against
real PostGIS — a known-intersecting pair and a known-non-intersecting pair,
plus an expected-area assertion on the hazard footprint polygon itself."""

import math

from geoalchemy2.shape import from_shape
from shapely.geometry import Point, mapping, shape

from app.db.models.enums import AssetCriticality, AssetType
from app.db.models.infrastructure_asset import InfrastructureAsset
from app.services.exposure_service import ExposureService
from tests.conftest import requires_postgres

CENTER = {"latitude": 22.5, "longitude": 88.3}


def _circle_geojson(lat: float, lon: float, radius_deg: float) -> dict:
    """A simple square-ish buffer polygon for a deterministic, easy-to-reason
    -about test geometry (not simulation/core/geo.py's circle_polygon — this
    test only needs a known area, not a realistic hazard shape)."""
    poly = Point(lon, lat).buffer(radius_deg, quad_segs=32)
    return mapping(poly)


@requires_postgres
def test_expected_area_of_test_geometry_is_close_to_circle_formula():
    radius_deg = 0.5
    geojson = _circle_geojson(CENTER["latitude"], CENTER["longitude"], radius_deg)
    poly = shape(geojson)
    expected_area = math.pi * radius_deg**2
    # shapely's buffer() polygon approximation is close to, not exactly, a
    # true circle's area — assert within 1%.
    assert math.isclose(poly.area, expected_area, rel_tol=0.01)


@requires_postgres
def test_compute_exposure_finds_known_intersecting_asset(db_session):
    inside = InfrastructureAsset(
        name="Inside Circle",
        asset_type=AssetType.HOSPITAL,
        criticality=AssetCriticality.HIGH,
        geometry=from_shape(Point(CENTER["longitude"], CENTER["latitude"]), srid=4326),
    )
    db_session.add(inside)
    db_session.commit()

    footprint = _circle_geojson(CENTER["latitude"], CENTER["longitude"], radius_deg=0.5)
    results = ExposureService(db_session).compute_exposure(footprint, buffer_km=1.0)

    hit = next((r for r in results if r.asset_name == "Inside Circle"), None)
    assert hit is not None
    assert hit.status == "within_hazard_footprint"
    assert hit.distance_km == 0.0


@requires_postgres
def test_compute_exposure_excludes_known_non_intersecting_asset(db_session):
    outside = InfrastructureAsset(
        name="Outside Circle",
        asset_type=AssetType.SHELTER,
        criticality=AssetCriticality.LOW,
        geometry=from_shape(Point(-20.0, -20.0), srid=4326),
    )
    db_session.add(outside)
    db_session.commit()

    footprint = _circle_geojson(CENTER["latitude"], CENTER["longitude"], radius_deg=0.5)
    results = ExposureService(db_session).compute_exposure(footprint, buffer_km=1.0)

    assert all(r.asset_name != "Outside Circle" for r in results)


@requires_postgres
def test_compute_exposure_reports_potentially_exposed_within_buffer(db_session):
    # ~0.6 degrees north of center (~0.1 deg outside the 0.5-degree radius
    # circle) but within a generous 50km buffer (~0.45 degrees).
    nearby = InfrastructureAsset(
        name="Nearby Not Intersecting",
        asset_type=AssetType.ROAD,
        criticality=AssetCriticality.MEDIUM,
        geometry=from_shape(Point(CENTER["longitude"], CENTER["latitude"] + 0.6), srid=4326),
    )
    db_session.add(nearby)
    db_session.commit()

    footprint = _circle_geojson(CENTER["latitude"], CENTER["longitude"], radius_deg=0.5)
    results = ExposureService(db_session).compute_exposure(footprint, buffer_km=50.0)

    hit = next((r for r in results if r.asset_name == "Nearby Not Intersecting"), None)
    assert hit is not None
    assert hit.status == "potentially_exposed"
    assert hit.distance_km is not None and hit.distance_km > 0
