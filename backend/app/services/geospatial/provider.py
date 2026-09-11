"""GeospatialProvider protocol — a fixed, code-configured source of real
geographic features. Never accepts a user-supplied URL (CLAUDE.md: don't let
arbitrary user input become an unrestricted server-side fetch); each concrete
provider hardcodes its own source."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.db.models.enums import GeographicDatasetType, GeospatialDataCoverage


@dataclass
class ProviderFeature:
    feature_type: str
    geometry: dict[str, Any]  # GeoJSON geometry dict, already EPSG:4326
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderDataset:
    """Everything a GeospatialProvider hands back — enough to populate a
    GeographicDataset row (with real provenance) plus its GeographicFeature
    rows, with nothing invented in between."""

    name: str
    dataset_type: GeographicDatasetType
    source_provider: str
    source_url: str
    license: str
    version: str
    resolution: str | None
    units: str | None
    coverage: GeospatialDataCoverage
    provenance: dict[str, Any]
    features: list[ProviderFeature]


class GeospatialProvider(ABC):
    """One real public geospatial source. `fetch_and_parse()` must raise
    (never silently return an empty/fabricated dataset) if the source is
    unreachable or unparsable — the caller (GeospatialService) is responsible
    for turning that into a GeospatialDataQuality.UNAVAILABLE result."""

    @abstractmethod
    def fetch_and_parse(self) -> ProviderDataset: ...
