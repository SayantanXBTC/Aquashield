from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from geoalchemy2.shape import WKBElement
from sqlalchemy import Enum as SAEnum
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import AssetCriticality, AssetType

if TYPE_CHECKING:
    from app.db.models.vulnerability_assessment import VulnerabilityAssessment


class InfrastructureAsset(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A real-world asset (hospital, port, road, ...) usable in vulnerability
    analysis. `geometry` is a generic PostGIS geometry so a single table can
    hold points (hospital), lines (road), and polygons (flood-prone district)."""

    __tablename__ = "infrastructure_assets"

    name: Mapped[str] = mapped_column(String(200))
    asset_type: Mapped[AssetType] = mapped_column(SAEnum(AssetType, name="asset_type"), index=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    criticality: Mapped[AssetCriticality] = mapped_column(
        SAEnum(AssetCriticality, name="asset_criticality"),
        default=AssetCriticality.MEDIUM,
        index=True,
    )
    # See scenario.py — GeoAlchemy2's own DDL event creates the GIST index.
    geometry: Mapped[WKBElement] = mapped_column(
        Geometry(geometry_type="GEOMETRY", srid=4326)
    )
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    vulnerability_assessments: Mapped[list["VulnerabilityAssessment"]] = relationship(
        back_populates="infrastructure_asset"
    )
