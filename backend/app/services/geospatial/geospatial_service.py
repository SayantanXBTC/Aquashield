"""Orchestrates real geospatial dataset ingestion and basic dataset-status
queries. Routes never call GeospatialProvider/repositories directly — this is
the one service in between (route -> service -> repository, CLAUDE.md §25)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from geoalchemy2.shape import from_shape
from shapely.geometry import box
from sqlalchemy.orm import Session

from app.db.geo import geojson_to_geometry
from app.db.models.enums import GeographicDatasetType, GeospatialDataQuality
from app.db.models.geographic_dataset import GeographicDataset
from app.db.models.geographic_feature import GeographicFeature
from app.repositories.geospatial_repository import (
    GeographicDatasetRepository,
    GeographicFeatureRepository,
)
from app.services.geospatial.provider import GeospatialProvider


class GeospatialServiceError(Exception):
    """Raised when ingestion fails — never converted into a silently-empty
    dataset (CLAUDE.md: no fake geographic data)."""


class GeospatialService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.datasets = GeographicDatasetRepository(session)
        self.features = GeographicFeatureRepository(session)

    def ingest(self, provider: GeospatialProvider, *, force: bool = False) -> GeographicDataset:
        """Fetches+parses via `provider` and persists a GeographicDataset +
        its GeographicFeature rows. Idempotent by (source_url, version)
        unless `force=True` — re-running the ingest script doesn't duplicate
        rows on every call."""
        try:
            parsed = provider.fetch_and_parse()
        except Exception as exc:
            raise GeospatialServiceError(f"Ingestion failed: {exc}") from exc

        existing = self.datasets.get_by_source_and_version(parsed.source_url, parsed.version)
        if existing is not None and not force:
            return existing
        if existing is not None and force:
            self.datasets.delete(existing)  # cascades to features

        if parsed.features:
            lons = [pt[0] for feat in parsed.features for pt in _iter_coords(feat.geometry)]
            lats = [pt[1] for feat in parsed.features for pt in _iter_coords(feat.geometry)]
            spatial_extent = from_shape(box(min(lons), min(lats), max(lons), max(lats)), srid=4326)
        else:
            spatial_extent = None

        dataset = GeographicDataset(
            name=parsed.name,
            dataset_type=parsed.dataset_type,
            source_provider=parsed.source_provider,
            source_url=parsed.source_url,
            license=parsed.license,
            version=parsed.version,
            spatial_extent=spatial_extent,
            resolution=parsed.resolution,
            units=parsed.units,
            data_quality=(
                GeospatialDataQuality.AVAILABLE if parsed.features else GeospatialDataQuality.PARTIAL
            ),
            coverage=parsed.coverage,
            provenance=parsed.provenance,
        )
        self.datasets.add(dataset)

        feature_rows = [
            GeographicFeature(
                dataset_id=dataset.id,
                feature_type=f.feature_type,
                geometry=geojson_to_geometry(f.geometry),
                properties=f.properties,
            )
            for f in parsed.features
        ]
        self.features.add_many(feature_rows)
        self.session.commit()
        self.session.refresh(dataset)
        return dataset

    def get_dataset(self, dataset_id: UUID) -> GeographicDataset | None:
        return self.datasets.get(dataset_id)

    def find_by_type(self, dataset_type: GeographicDatasetType) -> GeographicDataset | None:
        """Most recently ingested dataset of this type, or None — callers
        must treat None as GeospatialDataQuality.UNAVAILABLE, never fall back
        to fabricated geometry."""
        candidates = [d for d in self.datasets.list() if d.dataset_type == dataset_type]
        if not candidates:
            return None
        return max(candidates, key=lambda d: d.created_at)


def _iter_coords(geometry: dict[str, Any]):
    """Flattens a GeoJSON geometry's coordinate arrays regardless of nesting
    depth (Point/LineString/Polygon/Multi*) — used only to compute a bounding
    box, not for any physical calculation."""
    coords = geometry.get("coordinates")
    if coords is None:
        return
    yield from _flatten(coords)


def _flatten(coords: Any):
    if not coords:
        return
    first = coords[0]
    if isinstance(first, (int, float)):
        yield coords
    else:
        for item in coords:
            yield from _flatten(item)
