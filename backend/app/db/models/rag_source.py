"""Registry metadata for one ingested authoritative source (Prompt 16).

The chunks and embeddings themselves live in ChromaDB (`rag/vectorstore/`),
never here — same separation-of-concerns rule as `SimulationArtifact`
(CLAUDE.md §24): PostgreSQL holds metadata and a reference, never the bulk
data. `checksum` is what makes ingestion idempotent: `RagIngestionService`
skips re-embedding a file whose parsed-text checksum hasn't changed since the
row currently on record."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.enums import RagTrustLevel


class RagSource(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One authoritative document. `source_id` is the human-chosen stable
    slug from the source's frontmatter/sidecar metadata (rag/schemas/models.py
    `SourceMetadata.source_id`) — the primary key everything else (chunk ids,
    evidence ids) is namespaced under, kept distinct from the row's own UUID
    `id` the same way `Scenario.id` is distinct from a scenario's business
    key elsewhere in this schema."""

    __tablename__ = "rag_sources"

    source_id: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    publisher: Mapped[str] = mapped_column(String(200))
    authority: Mapped[str] = mapped_column(String(200))
    trust_level: Mapped[RagTrustLevel] = mapped_column(SAEnum(RagTrustLevel, name="rag_trust_level"))
    disaster_types: Mapped[list[str]] = mapped_column(ARRAY(String(32)))
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    publication_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    checksum: Mapped[str] = mapped_column(String(64))
    file_path: Mapped[str] = mapped_column(String(1000))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    is_test_fixture: Mapped[bool] = mapped_column(Boolean, default=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RagIngestionLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Audit trail of every ingestion attempt, including a skipped
    (checksum-unchanged) run and a failed one — the CLI and `rag validate`
    both read this to report what actually happened, never just "success"."""

    __tablename__ = "rag_ingestion_log"

    source_id: Mapped[str] = mapped_column(String(200), index=True)
    file_path: Mapped[str] = mapped_column(String(1000))
    outcome: Mapped[str] = mapped_column(String(32))  # ingested | skipped | failed
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    rag_source_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("rag_sources.id", ondelete="SET NULL"), nullable=True)
