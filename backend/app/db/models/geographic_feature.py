import uuid
from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from geoalchemy2.shape import WKBElement
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.geographic_dataset import GeographicDataset


class GeographicFeature(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One individual feature (a coastline segment, a land polygon, ...)
    belonging to a GeographicDataset. `geometry` is a generic PostGIS geometry
    (same pattern as InfrastructureAsset.geometry) so one table can hold
    points/lines/polygons depending on what the source dataset actually is —
    a coastline dataset stores LineStrings, not a forced Polygon."""

    __tablename__ = "geographic_features"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("geographic_datasets.id", ondelete="CASCADE"), index=True
    )
    feature_type: Mapped[str] = mapped_column(String(50))
    # See infrastructure_asset.py — GeoAlchemy2's DDL event creates the GIST
    # index; the migration must not also emit an explicit create_index.
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="GEOMETRY", srid=4326))
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)
    srid: Mapped[int] = mapped_column(Integer, default=4326)

    dataset: Mapped["GeographicDataset"] = relationship(back_populates="features")
