import uuid
from datetime import datetime

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import AIRequestStatus


class AIRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One AI analysis request and its audit trail (Prompt 14). Stores the
    request metadata, provider/model/prompt/agent versions, the tools the
    agents called, execution time and the structured Command Brief. Never an
    API key, never hidden chain-of-thought. The AI layer only ever writes to
    this table — simulation/geospatial tables are read-only to it."""

    __tablename__ = "ai_requests"

    owner_uid: Mapped[str] = mapped_column(String(128), index=True)
    scenario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenarios.id", ondelete="CASCADE"), index=True)
    simulation_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("simulation_runs.id", ondelete="CASCADE"), index=True)
    frame_index: Mapped[int] = mapped_column(Integer)
    user_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AIRequestStatus] = mapped_column(
        SAEnum(AIRequestStatus, name="ai_request_status"), default=AIRequestStatus.PENDING, index=True
    )
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    agent_versions: Mapped[dict] = mapped_column(JSONB, default=dict)
    tools_called: Mapped[list] = mapped_column(JSONB, default=list)
    execution_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
