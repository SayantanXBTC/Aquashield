"""Regulatory / RAG evidence retrieval — STUB.

The interface the Command Brief will eventually use to cite authoritative
documents (CLAUDE.md §11). No vector store is wired yet, so the only
implementation returns NOT_CONFIGURED and the brief records that as a data
limitation. Nothing may fabricate a source in its place."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from agents.schemas.evidence import NOT_CONFIGURED


@dataclass(frozen=True)
class RetrievedEvidence:
    source_id: str
    title: str
    excerpt: str
    relevance: float | None = None


@dataclass(frozen=True)
class RetrievalResult:
    status: str  # "ok" | NOT_CONFIGURED
    items: list[RetrievedEvidence] = field(default_factory=list)
    note: str | None = None


class EvidenceRetriever(Protocol):
    def retrieve(self, *, disaster_type: str, query: str, limit: int = 5) -> RetrievalResult: ...


class NotConfiguredEvidenceRetriever:
    def retrieve(self, *, disaster_type: str, query: str, limit: int = 5) -> RetrievalResult:
        return RetrievalResult(
            status=NOT_CONFIGURED,
            items=[],
            note="No knowledge base is configured; regulatory/SOP citations are unavailable.",
        )
