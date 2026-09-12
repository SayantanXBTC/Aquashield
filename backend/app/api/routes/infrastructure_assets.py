from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.geospatial import ExposureResultOut, InfrastructureAssetListResponse
from app.services.infrastructure_service import InfrastructureService

router = APIRouter(prefix="/infrastructure-assets", tags=["geospatial"])


def get_infrastructure_service(db: Annotated[Session, Depends(get_db)]) -> InfrastructureService:
    return InfrastructureService(db)


@router.get("", response_model=InfrastructureAssetListResponse)
def list_infrastructure_assets(
    service: Annotated[InfrastructureService, Depends(get_infrastructure_service)],
) -> InfrastructureAssetListResponse:
    """Every known InfrastructureAsset, independent of any scenario/run —
    lets the Command Center's "Infrastructure" data layer show real assets
    before a simulation has even been executed. Exposure status against a
    specific hazard footprint is a separate question — see
    GET /simulation-runs/{id}/exposure."""
    assets = service.list_all()
    return InfrastructureAssetListResponse(
        data_quality="available" if assets else "unavailable",
        assets=[ExposureResultOut(**vars(asset)) for asset in assets],
    )
