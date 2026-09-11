import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import SimulationStatus

if TYPE_CHECKING:
    from app.db.models.incident_action_plan import IncidentActionPlan
    from app.db.models.response_recommendation import ResponseRecommendation
    from app.db.models.risk_assessment import RiskAssessment
    from app.db.models.scenario_version import ScenarioVersion
    from app.db.models.simulation_artifact import SimulationArtifact
    from app.db.models.vulnerability_assessment import VulnerabilityAssessment


class SimulationRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One execution of a ScenarioVersion. Stores run metadata/status only —
    the actual time-series state lives in scientific-data storage, referenced
    via SimulationArtifact (see architecture.md §24: PostgreSQL stores metadata,
    not simulation grids)."""

    __tablename__ = "simulation_runs"

    scenario_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scenario_versions.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[SimulationStatus] = mapped_column(
        SAEnum(SimulationStatus, name="simulation_status"),
        default=SimulationStatus.PENDING,
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    timestep_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    model_identifier: Mapped[str | None] = mapped_column(String(200), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    scenario_version: Mapped["ScenarioVersion"] = relationship(back_populates="simulation_runs")
    risk_assessments: Mapped[list["RiskAssessment"]] = relationship(
        back_populates="simulation_run", cascade="all, delete-orphan"
    )
    vulnerability_assessments: Mapped[list["VulnerabilityAssessment"]] = relationship(
        back_populates="simulation_run", cascade="all, delete-orphan"
    )
    response_recommendations: Mapped[list["ResponseRecommendation"]] = relationship(
        back_populates="simulation_run", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list["SimulationArtifact"]] = relationship(
        back_populates="simulation_run", cascade="all, delete-orphan"
    )
    incident_action_plans: Mapped[list["IncidentActionPlan"]] = relationship(
        back_populates="simulation_run", cascade="all, delete-orphan"
    )
