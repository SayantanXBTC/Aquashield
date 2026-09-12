"""Thin service behind `POST /rag/retrieve` — lets an operator or a test
exercise the hybrid retriever directly, outside a full AI analysis run.
Read-only; retrieval is not owner-scoped (authoritative sources are shared
knowledge, not user data), but the route itself still requires a verified
caller like every other endpoint."""

from __future__ import annotations

from app.config.settings import settings

from agents.tools.retrieval.evidence_retriever import EvidenceRetriever, build_evidence_retriever
from rag.schemas.models import EvidencePack, RetrievalQuery

_retriever: EvidenceRetriever | None = None
_retriever_provider: str | None = None


def get_retriever() -> EvidenceRetriever:
    """Cached at module level: `HybridRetriever` opens a persistent Chroma
    client, which is wasteful to reopen per request. Rebuilt only if the
    configured provider changes (tests override `settings.rag_provider`)."""

    global _retriever, _retriever_provider
    if _retriever is None or _retriever_provider != settings.rag_provider:
        _retriever = build_evidence_retriever(
            settings.rag_provider,
            persist_directory=settings.rag_vectorstore_dir,
            embedding_provider_name=settings.rag_embedding_provider,
            relevance_threshold=settings.rag_relevance_threshold,
        )
        _retriever_provider = settings.rag_provider
    return _retriever


def reset_retriever_cache() -> None:
    """Test-only — forces the next `get_retriever()` to rebuild."""

    global _retriever, _retriever_provider
    _retriever, _retriever_provider = None, None


class RagRetrievalService:
    def __init__(self, retriever: EvidenceRetriever | None = None) -> None:
        self.retriever = retriever or get_retriever()

    def retrieve(self, query: RetrievalQuery) -> EvidencePack:
        return self.retriever.retrieve(query)
