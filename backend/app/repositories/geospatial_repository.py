from uuid import UUID

from geoalchemy2 import Geometry
from geoalchemy2.types import Geography, WKBElement
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.db.models.geographic_dataset import GeographicDataset
from app.db.models.geographic_feature import GeographicFeature


class GeographicDatasetRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, dataset: GeographicDataset) -> GeographicDataset:
        self.session.add(dataset)
        self.session.flush()
        return dataset

    def get(self, dataset_id: UUID) -> GeographicDataset | None:
        return self.session.get(GeographicDataset, dataset_id)

    def get_by_source_and_version(self, source_url: str, version: str) -> GeographicDataset | None:
        """Idempotency check: don't re-ingest the same provider version twice
        unless the caller explicitly forces it."""
        stmt = select(GeographicDataset).where(
            GeographicDataset.source_url == source_url,
            GeographicDataset.version == version,
        )
        return self.session.execute(stmt).scalars().first()

    def list(self) -> list[GeographicDataset]:
        return list(self.session.execute(select(GeographicDataset)).scalars().all())

    def delete(self, dataset: GeographicDataset) -> None:
        self.session.delete(dataset)
        self.session.flush()


class GeographicFeatureRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add_many(self, features: list[GeographicFeature]) -> list[GeographicFeature]:
        self.session.add_all(features)
        self.session.flush()
        return features

    def list_for_dataset(self, dataset_id: UUID) -> list[GeographicFeature]:
        stmt = select(GeographicFeature).where(GeographicFeature.dataset_id == dataset_id)
        return list(self.session.execute(stmt).scalars().all())

    def count_for_dataset(self, dataset_id: UUID) -> int:
        return len(self.list_for_dataset(dataset_id))

    def find_within_distance_clipped(
        self, point: WKBElement, distance_km: float
    ) -> list[tuple[GeographicFeature, WKBElement]]:
        """Features within `distance_km` of `point`, using a geography cast
        (unlike infrastructure_asset_repository's planar-degree ST_DWithin,
        which is fine at that module's ~10km prototype scale) — a coastline
        search radius is typically hundreds of km, where the degree/km ratio
        varies enough with latitude that a geography cast is worth the extra
        accuracy.

        A raw Natural Earth coastline feature can be a single LineString
        spanning an entire continent (hundreds of vertices, thousands of km)
        — returning it whole would ship irrelevant geometry and place most of
        it far outside any local 3D view. Each result is paired with its
        geometry already clipped (`ST_Intersection`) to a buffer polygon
        around `point`, so only the locally-relevant segment is returned."""
        distance_m = distance_km * 1000
        buffer_geography = func.ST_Buffer(cast(point, Geography), distance_m)
        buffer_geometry = cast(buffer_geography, Geometry(srid=4326))
        clipped = func.ST_Intersection(GeographicFeature.geometry, buffer_geometry).label("clipped_geometry")
        stmt = select(GeographicFeature, clipped).where(
            func.ST_DWithin(
                cast(GeographicFeature.geometry, Geography),
                cast(point, Geography),
                distance_m,
            )
        )
        return [(feature, clipped_geom) for feature, clipped_geom in self.session.execute(stmt).all()]
