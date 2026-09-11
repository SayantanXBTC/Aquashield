from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from geoalchemy2.shape import WKBElement
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import GeographicDatasetType, GeospatialDataCoverage, GeospatialDataQuality

if TYPE_CHECKING:
    from app.db.models.geographic_feature import GeographicFeature


class GeographicDataset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Metadata for one ingested real-world geographic layer (e.g. Natural
    Earth's 110m coastline). `spatial_extent` is the dataset's bounding
    geometry (a Polygon envelope), not the individual features themselves —
    those live in GeographicFeature rows below, one dataset : many features.

    This is the "real public geospatial source" table Prompt 10 requires —
    provenance (source_provider/source_url/license) is stored as real data
    here, not only documented in prose, so an API response can always cite
    exactly where a geometry came from (CLAUDE.md: no fake geographic data
    presented as real)."""

    __tablename__ = "geographic_datasets"

    name: Mapped[str] = mapped_column(String(200))
    dataset_type: Mapped[GeographicDatasetType] = mapped_column(
        SAEnum(GeographicDatasetType, name="geographic_dataset_type"), index=True
    )
    source_provider: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str] = mapped_column(Text)
    license: Mapped[str] = mapped_column(String(200))
    version: Mapped[str] = mapped_column(String(50))
    # Bounding envelope of the dataset's features, for a cheap "does this
    # dataset cover this scenario's location" check without scanning every
    # feature. See infrastructure_asset.py — GeoAlchemy2's own DDL event
    # creates the GIST index; the migration must not also emit one.
    spatial_extent: Mapped[WKBElement | None] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326), nullable=True
    )
    srid: Mapped[int] = mapped_column(Integer, default=4326)
    resolution: Mapped[str | None] = mapped_column(String(50), nullable=True)
    units: Mapped[str | None] = mapped_column(String(50), nullable=True)
    data_quality: Mapped[GeospatialDataQuality] = mapped_column(
        SAEnum(GeospatialDataQuality, name="geospatial_data_quality"),
        default=GeospatialDataQuality.AVAILABLE,
        index=True,
    )
    coverage: Mapped[GeospatialDataCoverage] = mapped_column(
        SAEnum(GeospatialDataCoverage, name="geospatial_data_coverage"),
        default=GeospatialDataCoverage.GLOBAL,
    )
    # Free-form real provenance detail (fetch timestamp, feature count at
    # ingestion, checksum, attribution text) — never fabricated fields.
    provenance: Mapped[dict] = mapped_column("provenance_metadata", JSONB, default=dict)

    features: Mapped[list["GeographicFeature"]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan"
    )
