from fastapi import APIRouter

from app.core.disaster_catalog import build_disaster_catalog
from app.schemas.disaster_catalog import DisasterCatalogEntry

router = APIRouter(prefix="/disaster-types", tags=["disaster-types"])


@router.get("", response_model=list[DisasterCatalogEntry])
def list_disaster_types() -> list[DisasterCatalogEntry]:
    """Discovery/documentation aid only — see docs/development/scenarios.md
    "Discovery endpoint". Not the Scenario Builder form's live data source;
    that stays `disasterFieldSpecs.ts` (CLAUDE.md §25 parallel-registry
    pattern, same as the backend's own `DISASTER_CONFIG_SCHEMAS`)."""
    return [DisasterCatalogEntry(**entry) for entry in build_disaster_catalog()]
