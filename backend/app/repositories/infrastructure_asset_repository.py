from typing import Any

from geoalchemy2.types import WKBElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.infrastructure_asset import InfrastructureAsset


class InfrastructureAssetRepository:
    """All raw PostGIS ST_* query-building for InfrastructureAsset lives here
    — app/services/exposure_service.py calls this, it never builds SQLAlchemy
    queries itself (CLAUDE.md §25 layering, extended to the exposure domain)."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def find_intersecting(self, geometry: WKBElement) -> list[InfrastructureAsset]:
        stmt = select(InfrastructureAsset).where(func.ST_Intersects(InfrastructureAsset.geometry, geometry))
        return list(self.session.execute(stmt).scalars().all())

    def find_within_distance(
        self, geometry: WKBElement, distance_degrees: float
    ) -> list[tuple[InfrastructureAsset, float]]:
        """Returns (asset, distance_in_degrees) pairs for every asset within
        `distance_degrees` of `geometry` — degree-based, matching the
        established convention in backend/tests/db/test_spatial.py (ST_DWithin
        run directly against the planar Geometry column, not a geography
        cast). The caller converts degrees to an approximate km figure."""
        stmt = select(
            InfrastructureAsset,
            func.ST_Distance(InfrastructureAsset.geometry, geometry).label("distance_degrees"),
        ).where(func.ST_DWithin(InfrastructureAsset.geometry, geometry, distance_degrees))
        return [(asset, float(distance)) for asset, distance in self.session.execute(stmt).all()]

    def list_all(self) -> list[InfrastructureAsset]:
        return list(self.session.execute(select(InfrastructureAsset)).scalars().all())
