import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin
from app.db.models.enums import EventType


class AuditEvent(UUIDPrimaryKeyMixin, Base):
    """Lightweight, append-only event log (no updated_at — audit rows are
    immutable). Establishes the foundation for explaining "why did you
    recommend this" (CLAUDE.md §13) — not a full enterprise audit system."""

    __tablename__ = "audit_events"

    event_type: Mapped[EventType] = mapped_column(SAEnum(EventType, name="event_type"), index=True)
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scenarios.id", ondelete="SET NULL"), nullable=True, index=True
    )
    simulation_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("simulation_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
