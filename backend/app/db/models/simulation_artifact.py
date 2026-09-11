import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import ArtifactType

if TYPE_CHECKING:
    from app.db.models.simulation_run import SimulationRun


class SimulationArtifact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Metadata + a reference to a simulation output file (NetCDF/Zarr/GeoTIFF/...).
    `storage_location` is a URI/path pointer — the dataset itself never lives in
    this table (architecture.md §24: PostgreSQL knows WHERE and WHAT, not the
    full scientific dataset)."""

    __tablename__ = "simulation_artifacts"

    simulation_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), index=True
    )
    artifact_type: Mapped[ArtifactType] = mapped_column(
        SAEnum(ArtifactType, name="artifact_type"), index=True
    )
    storage_location: Mapped[str] = mapped_column(Text)
    format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timestep_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timestep_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Bounding-box/extent metadata as JSON — not a queryable PostGIS geometry.
    # A future geometry column can be added if bbox spatial queries are needed.
    spatial_extent: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    simulation_run: Mapped["SimulationRun"] = relationship(back_populates="artifacts")
