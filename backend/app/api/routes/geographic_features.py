from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.geo import geometry_to_geojson
from app.db.session import get_db
from app.schemas.geospatial import GeographicFeatureOut, NearbyFeaturesResponse
from app.services.geospatial.geospatial_service import GeospatialService

router = APIRouter(prefix="/geographic-features", tags=["geospatial"])


def get_geospatial_service(db: Annotated[Session, Depends(get_db)]) -> GeospatialService:
    return GeospatialService(db)


@router.get("/nearby", response_model=NearbyFeaturesResponse)
def list_nearby_features(
    service: Annotated[GeospatialService, Depends(get_geospatial_service)],
    latitude: Annotated[float, Query(ge=-90, le=90)],
    longitude: Annotated[float, Query(ge=-180, le=180)],
    radius_km: Annotated[float, Query(gt=0, le=2000)] = 300.0,
) -> NearbyFeaturesResponse:
    """Real, previously-ingested geographic features (e.g. Natural Earth
    coastline — see app/services/geospatial/natural_earth_provider.py) near a
    point — gives a scenario's location real geographic context. `radius_km`
    is capped at 2000 to keep this a bounded query, not an unrestricted
    global fetch (Prompt 10 §27)."""
    results = service.find_nearby_features(latitude, longitude, radius_km)
    return NearbyFeaturesResponse(
        data_quality="available" if results else "unavailable",
        radius_km=radius_km,
        features=[
            GeographicFeatureOut(
                id=f.id,
                feature_type=f.feature_type,
                geometry=geometry_to_geojson(clipped_geometry),
                properties=f.properties,
                dataset_name=f.dataset.name,
                source_provider=f.dataset.source_provider,
                license=f.dataset.license,
            )
            for f, clipped_geometry in results
        ],
    )
