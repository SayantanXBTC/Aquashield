from uuid import UUID

from sqlalchemy import select
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
