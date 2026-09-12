"""Always-available infrastructure listing — independent of any simulation
run or hazard footprint. Existence of an asset (a hospital, a road) is a
geographic fact; whether it's exposed to a hazard is a separate question
answered by app/services/exposure_service.py once a run/frame is chosen.
Kept as its own service rather than folded into ExposureService so the
Command Center's "Infrastructure" layer can render real markers before a
scenario has ever been executed."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.geo import geometry_centroid_latlon
from app.repositories.infrastructure_asset_repository import InfrastructureAssetRepository
from app.services.exposure_service import ExposureResult


class InfrastructureService:
    def __init__(self, session: Session) -> None:
        self.assets = InfrastructureAssetRepository(session)

    def list_all(self) -> list[ExposureResult]:
        """Every known InfrastructureAsset, with status "no_active_hazard" —
        not yet evaluated against any hazard footprint (there may be none
        selected, or the scenario's run may not have executed)."""
        return [
            ExposureResult(
                asset_id=str(asset.id),
                asset_name=asset.name,
                asset_type=asset.asset_type.value,
                criticality=asset.criticality.value,
                status="no_active_hazard",
                distance_km=None,
                **geometry_centroid_latlon(asset.geometry),
            )
            for asset in self.assets.list_all()
        ]
