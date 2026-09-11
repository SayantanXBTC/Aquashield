import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.scenario import Scenario
    from app.db.models.simulation_run import SimulationRun


class ScenarioVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One point-in-time configuration of a Scenario. Never overwritten — new
    edits create a new version, enabling replay/comparison (architecture.md §7/§11)."""

    __tablename__ = "scenario_versions"
    __table_args__ = (
        UniqueConstraint("scenario_id", "version_number", name="uq_scenario_version_number"),
    )

    scenario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scenarios.id", ondelete="CASCADE"), index=True
    )
    version_number: Mapped[int] = mapped_column(Integer)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Disaster-specific parameters (flood: rainfall/river_level/..., tsunami:
    # magnitude/source_location/..., etc.) — see architecture.md §10. Common,
    # cross-disaster fields stay relational on Scenario/ScenarioVersion; only
    # genuinely variable, disaster-specific config goes here.
    scenario_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    scenario: Mapped["Scenario"] = relationship(back_populates="versions")
    simulation_runs: Mapped[list["SimulationRun"]] = relationship(
        back_populates="scenario_version", cascade="all, delete-orphan"
    )
