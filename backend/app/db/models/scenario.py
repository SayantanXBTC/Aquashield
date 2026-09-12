from typing import TYPE_CHECKING

from geoalchemy2 import Geography
from geoalchemy2.shape import WKBElement
from sqlalchemy import Enum as SAEnum
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import DisasterType, ScenarioStatus

if TYPE_CHECKING:
    from app.db.models.scenario_version import ScenarioVersion


class Scenario(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A user-created disaster scenario. Disaster-specific configuration lives on
    ScenarioVersion.scenario_config (JSONB), not as columns here — see
    architecture.md §6 for the Scenario/DisasterModel abstraction this mirrors."""

    __tablename__ = "scenarios"

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    disaster_type: Mapped[DisasterType] = mapped_column(
        SAEnum(DisasterType, name="disaster_type"), index=True
    )
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Representative point (e.g. tsunami source, spill origin). Optional — many
    # scenarios are better represented by an area, which lives on the relevant
    # ScenarioVersion.scenario_config instead of forcing a single point here.
    # GeoAlchemy2 creates the GIST index itself via a DDL event on table
    # creation (spatial_index=True, the default) — the Alembic migration must
    # NOT also emit an explicit create_index for this column, or the two
    # collide (see docs/development/database.md).
    location: Mapped[WKBElement | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    status: Mapped[ScenarioStatus] = mapped_column(
        SAEnum(ScenarioStatus, name="scenario_status"),
        default=ScenarioStatus.DRAFT,
        index=True,
    )
    created_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Firebase Authentication uid of the owner (the verified `sub` claim —
    # app/core/auth.py). Every read/write is scoped to this value; a scenario
    # is never visible to any other account. Indexed because every list query
    # filters on it.
    owner_uid: Mapped[str] = mapped_column(String(128), index=True)

    versions: Mapped[list["ScenarioVersion"]] = relationship(
        back_populates="scenario",
        cascade="all, delete-orphan",
        order_by="ScenarioVersion.version_number",
    )
