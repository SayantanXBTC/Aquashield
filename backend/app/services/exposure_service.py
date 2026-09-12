"""Spatial exposure analysis: given a hazard footprint geometry, which
InfrastructureAsset rows intersect it or lie within a buffer distance.
Raw PostGIS ST_* queries live in
app/repositories/infrastructure_asset_repository.py; this module only turns
those rows into the ExposureResult business shape (route -> service ->
repository, CLAUDE.md §25, extended to this domain).

Wording discipline (CLAUDE.md): a result is only ever "within_hazard_footprint"
(true geometric intersection) or "potentially_exposed" (nearby, within a
buffer, not intersecting) — never "damaged", "destroyed", or "will be
affected". This module makes no damage/casualty claim of any kind.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.db.geo import geojson_to_geometry, geometry_centroid_latlon
from app.repositories.infrastructure_asset_repository import InfrastructureAssetRepository

# "no_active_hazard" is used by app/services/infrastructure_service.py for
# the always-available asset listing (no run/hazard footprint involved yet)
# — kept in the same union as the two hazard-derived statuses so
# ExposureResult/ExposureResultOut/InfrastructureMarkers don't need a second,
# parallel status type.
ExposureStatus = Literal["within_hazard_footprint", "potentially_exposed", "no_active_hazard"]

# Demo-scale default buffer for "potentially exposed" (nearby but not
# intersecting) — an arbitrary, documented prototype constant, not derived
# from any hazard-specific standoff distance.
DEFAULT_BUFFER_KM = 10.0

# Same rough conversion used for the ST_DWithin buffer as
# simulation/core/geo.py's great-circle math — a planar degrees-per-km
# approximation is adequate at this prototype's scale and query-radius sizes
# (a handful to a few hundred km), consistent with the existing
# test_spatial.py convention of running ST_DWithin directly in degrees
# against the planar `Geometry` column (not a geography cast).
KM_PER_DEGREE = 111.32


@dataclass
class ExposureResult:
    asset_id: str
    asset_name: str
    asset_type: str
    criticality: str
    status: ExposureStatus
    distance_km: float | None
    # A representative (lat, lon) point for rendering a marker — the asset's
    # own geometry centroid (accurate for a Point asset; for a LineString/
    # Polygon asset this is the true geometric centroid, not necessarily a
    # point that lies on the feature itself, e.g. a bent road's centroid can
    # fall off the road). A rendering convenience, not a claim about the
    # asset's "true" location for a non-point feature.
    latitude: float
    longitude: float


class ExposureService:
    def __init__(self, session: Session) -> None:
        self.assets = InfrastructureAssetRepository(session)

    def compute_exposure(
        self,
        footprint_geometry: dict[str, Any],
        *,
        buffer_km: float = DEFAULT_BUFFER_KM,
    ) -> list[ExposureResult]:
        """Returns every InfrastructureAsset that intersects
        `footprint_geometry` or lies within `buffer_km` of it, each exactly
        once (an intersecting asset is reported as "within_hazard_footprint",
        never also as "potentially_exposed")."""
        footprint = geojson_to_geometry(footprint_geometry)
        buffer_degrees = buffer_km / KM_PER_DEGREE

        intersecting = self.assets.find_intersecting(footprint)
        intersecting_ids = {asset.id for asset in intersecting}

        results: list[ExposureResult] = [
            ExposureResult(
                asset_id=str(asset.id),
                asset_name=asset.name,
                asset_type=asset.asset_type.value,
                criticality=asset.criticality.value,
                status="within_hazard_footprint",
                distance_km=0.0,
                **geometry_centroid_latlon(asset.geometry),
            )
            for asset in intersecting
        ]

        for asset, distance_degrees in self.assets.find_within_distance(footprint, buffer_degrees):
            if asset.id in intersecting_ids:
                continue
            results.append(
                ExposureResult(
                    asset_id=str(asset.id),
                    asset_name=asset.name,
                    asset_type=asset.asset_type.value,
                    criticality=asset.criticality.value,
                    status="potentially_exposed",
                    distance_km=round(distance_degrees * KM_PER_DEGREE, 3),
                    **geometry_centroid_latlon(asset.geometry),
                )
            )

        return results
