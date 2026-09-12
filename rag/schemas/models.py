"""RAG data contracts.

Every retrieval result flows through these shapes. `EvidenceItem` is the only
currency an agent may cite as authoritative-source support — a citation that
doesn't resolve to an `EvidenceItem.evidence_id` from the pack that produced
it is dropped, never rendered (agents/agents/command/synthesis.py). Nothing
here is fabricated: a low-confidence or empty retrieval is
`INSUFFICIENT_EVIDENCE` or `UNAVAILABLE`, never a guessed citation.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

# Matches rag/sources/'s folder taxonomy (rag/sources/README.md) and
# shared/types DisasterType (backend/app/db/models/enums.py) plus "general"
# for cross-cutting guidance (SOPs, coordination frameworks).
DisasterCategory = Literal[
    "flood", "cyclone", "tsunami", "oil_spill", "pollution", "search_rescue", "environmental", "general"
]

TrustLevel = Literal["TIER_1", "TIER_2", "TIER_3", "TIER_4"]
TRUST_LEVELS: tuple[TrustLevel, ...] = ("TIER_1", "TIER_2", "TIER_3", "TIER_4")

EvidenceStatus = Literal["SUPPORTED", "INSUFFICIENT_EVIDENCE", "UNAVAILABLE"]

# The agent role a retrieval was scoped for (architecture.md §10 "Role-
# Specific Scopes"). Query phrasing and, later, source-category weighting
# both key off this.
AgentRole = Literal["hazard", "damage", "risk", "precaution", "response"]

ClaimType = Literal["OBSERVED", "CALCULATED", "EVIDENCE_GROUNDED", "RECOMMENDED"]
ValidationStatus = Literal["SUPPORTED", "PARTIAL", "UNSUPPORTED"]


def checksum_of(text: str) -> str:
    """Stable content hash for idempotent ingestion — the same source text
    always produces the same checksum, so re-ingesting an unchanged document
    is a no-op and a changed one replaces its chunks rather than duplicating
    them."""

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class SourceMetadata(BaseModel):
    """One authoritative document's registry entry (Postgres side; see
    `backend/app/db/models/rag_source.py`). `checksum` is of the raw parsed
    text, computed by the parser — it is what makes ingestion idempotent."""

    source_id: str = Field(description="Stable slug, e.g. 'undrr-tsunami-preparedness-2023'.")
    title: str
    publisher: str
    authority: str = Field(description="The issuing body's short name, e.g. 'UNDRR', 'NOAA'.")
    trust_level: TrustLevel
    disaster_types: list[DisasterCategory] = Field(min_length=1)
    url: str | None = None
    publication_date: date | None = None
    checksum: str
    file_path: str = Field(description="Path the content was parsed from, relative to the repo.")
    is_test_fixture: bool = Field(
        default=False,
        description="True only for rag/tests/fixtures/ material — never for anything under rag/sources/.",
    )


class Chunk(BaseModel):
    """One semantic slice of a parsed document, ready to embed."""

    chunk_id: str
    source_id: str
    document_id: str = Field(description="Usually == source_id; distinct only if one source yields several documents.")
    text: str
    section: str | None = None
    page: int | None = None
    token_count: int


class EvidenceItem(BaseModel):
    """One citable authoritative-source excerpt, returned by retrieval."""

    evidence_id: str = Field(description="Stable id an agent cites, e.g. 'RAG-a1b2c3d4-0'.")
    source_id: str
    authority: str
    title: str
    trust_level: TrustLevel
    section: str | None = None
    page: int | None = None
    url: str | None = None
    relevance_score: float = Field(ge=0.0, le=1.0)
    text_snippet: str = Field(max_length=800)


class EvidencePack(BaseModel):
    """The result of one role-scoped retrieval."""

    query: str
    role: AgentRole
    disaster_type: str
    evidence_status: EvidenceStatus
    items: list[EvidenceItem] = Field(default_factory=list)
    retriever_version: str
    # A free-string reason code for the DataLimitation this pack becomes on
    # the Command Brief when evidence_status != SUPPORTED (agents/agents/
    # command/synthesis.py) — kept separate from the closed evidence_status
    # enum above so the brief's existing limitation codes (NOT_CONFIGURED,
    # RAG_UNAVAILABLE, ...) stay free-form and backward compatible.
    limitation_code: str | None = None
    note: str | None = None
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClaimMapping(BaseModel):
    """Audit record: one claim in the Command Brief and what grounds it.
    Built by the Safety Validator, never by an agent — an agent cannot mark
    its own claim SUPPORTED."""

    claim_text: str = Field(max_length=600)
    claim_type: ClaimType
    supported_by: list[str] = Field(default_factory=list, description="Evidence ids (simulation E-ids and/or RAG- ids).")
    validation_status: ValidationStatus


class RetrievalQuery(BaseModel):
    """What the retrieval builder hands to the hybrid retriever."""

    role: AgentRole
    disaster_type: str
    hazard_summary: str = Field(default="", max_length=400)
    impacted_asset_types: list[str] = Field(default_factory=list)
    operator_question: str | None = None
    limit: int = Field(default=5, ge=1, le=20)
