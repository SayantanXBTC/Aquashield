import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import (
    RecommendationPriority,
    RecommendationSource,
    RecommendationStatus,
)

if TYPE_CHECKING:
    from app.db.models.simulation_run import SimulationRun


class ResponseRecommendation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A recommended action for a SimulationRun. `source` records where it came
    from — the schema does not assume every recommendation is AI-generated
    (CLAUDE.md §5, architecture.md §17)."""

    __tablename__ = "response_recommendations"

    simulation_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), index=True
    )
    priority: Mapped[RecommendationPriority] = mapped_column(
        SAEnum(RecommendationPriority, name="recommendation_priority"), index=True
    )
    action: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsible_role: Mapped[str | None] = mapped_column(String(200), nullable=True)
    deadline_timestep: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[RecommendationSource] = mapped_column(
        SAEnum(RecommendationSource, name="recommendation_source"),
        default=RecommendationSource.RULE_BASED,
    )
    status: Mapped[RecommendationStatus] = mapped_column(
        SAEnum(RecommendationStatus, name="recommendation_status"),
        default=RecommendationStatus.PROPOSED,
        index=True,
    )

    simulation_run: Mapped["SimulationRun"] = relationship(
        back_populates="response_recommendations"
    )
