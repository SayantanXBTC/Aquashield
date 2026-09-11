import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import RiskCategory, RiskLevel

if TYPE_CHECKING:
    from app.db.models.simulation_run import SimulationRun


class RiskAssessment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An application-level risk output for one SimulationRun. Not a claim of
    scientifically validated prediction — see CLAUDE.md §7 (Do Not Overpromise)."""

    __tablename__ = "risk_assessments"

    simulation_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[RiskCategory] = mapped_column(
        SAEnum(RiskCategory, name="risk_category"), index=True
    )
    level: Mapped[RiskLevel] = mapped_column(SAEnum(RiskLevel, name="risk_level"), index=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestep: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    simulation_run: Mapped["SimulationRun"] = relationship(back_populates="risk_assessments")
