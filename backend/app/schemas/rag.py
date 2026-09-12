"""API shapes for the RAG endpoints. `EvidencePack`/`EvidenceItem`/
`RetrievalQuery` are the rag package's own Pydantic models, re-exported so
the API contract and the retriever's return value are the same object — the
same pattern app/schemas/ai.py uses for `CommandBrief`."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from rag.schemas.models import AgentRole, EvidencePack, RetrievalQuery  # noqa: F401 — re-exported

from app.db.models.enums import RagTrustLevel


class RagRetrieveRequest(BaseModel):
    role: AgentRole
    disaster_type: str
    hazard_summary: str = ""
    impacted_asset_types: list[str] = []
    operator_question: str | None = None
    limit: int = 5


class RagSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_id: str
    title: str
    publisher: str
    authority: str
    trust_level: RagTrustLevel
    disaster_types: list[str]
    url: str | None = None
    publication_date: date | None = None
    chunk_count: int
    is_test_fixture: bool
    ingested_at: datetime


class RagHealthOut(BaseModel):
    provider: str
    configured: bool
    source_count: int
    chunk_count: int | None = None
