from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point
from sqlalchemy import func, select

from app.db.models.enums import AssetCriticality, AssetType
from app.db.models.infrastructure_asset import InfrastructureAsset
from tests.conftest import requires_postgres


@requires_postgres
def test_infrastructure_asset_spatial_storage(db_session) -> None:
    asset = InfrastructureAsset(
        name="Test Hospital",
        asset_type=AssetType.HOSPITAL,
        criticality=AssetCriticality.CRITICAL,
        geometry=from_shape(Point(90.41, 23.81), srid=4326),
    )
    db_session.add(asset)
    db_session.commit()

    fetched = db_session.get(InfrastructureAsset, asset.id)
    assert fetched is not None
    point = to_shape(fetched.geometry)
    assert point.x == 90.41
    assert point.y == 23.81


@requires_postgres
def test_postgis_spatial_query_finds_nearby_asset(db_session) -> None:
    near = InfrastructureAsset(
        name="Nearby Asset",
        asset_type=AssetType.SHELTER,
        criticality=AssetCriticality.MEDIUM,
        geometry=from_shape(Point(90.41, 23.81), srid=4326),
    )
    far = InfrastructureAsset(
        name="Far Asset",
        asset_type=AssetType.SHELTER,
        criticality=AssetCriticality.MEDIUM,
        geometry=from_shape(Point(-10.0, -10.0), srid=4326),
    )
    db_session.add_all([near, far])
    db_session.commit()

    reference_point = func.ST_SetSRID(func.ST_MakePoint(90.40, 23.80), 4326)
    nearby = db_session.execute(
        select(InfrastructureAsset.name).where(
            func.ST_DWithin(
                InfrastructureAsset.geometry,
                reference_point,
                1.0,  # degrees — generous for a demo-scale query
            )
        )
    ).scalars().all()

    assert "Nearby Asset" in nearby
    assert "Far Asset" not in nearby
