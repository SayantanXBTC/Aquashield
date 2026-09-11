import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.simulation_run import SimulationRun


class IncidentActionPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A generated Incident Action Plan for a SimulationRun. Narrative sections
    are structured text columns; genuinely variable/list-shaped sections use
    JSONB — see architecture.md §18/§13 (avoid one opaque text blob, avoid
    excessive normalization)."""

    __tablename__ = "incident_action_plans"

    simulation_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), index=True
    )
    incident_overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    situation_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    objectives: Mapped[list] = mapped_column(JSONB, default=list)
    priority_actions: Mapped[list] = mapped_column(JSONB, default=list)
    operational_period: Mapped[dict] = mapped_column(JSONB, default=dict)
    resources: Mapped[dict] = mapped_column(JSONB, default=dict)
    evacuation_strategy: Mapped[str | None] = mapped_column(Text, nullable=True)
    safety_considerations: Mapped[str | None] = mapped_column(Text, nullable=True)
    communication_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    environmental_considerations: Mapped[str | None] = mapped_column(Text, nullable=True)
    monitoring_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_triggers: Mapped[list] = mapped_column(JSONB, default=list)
    sources: Mapped[list] = mapped_column(JSONB, default=list)
    generation_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)

    simulation_run: Mapped["SimulationRun"] = relationship(
        back_populates="incident_action_plans"
    )
