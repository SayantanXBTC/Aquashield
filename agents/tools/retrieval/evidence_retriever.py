"""Regulatory / RAG evidence retrieval — the sanctioned boundary between
`agents/` and `rag/` (rag/README.md: "Agents call this domain through a
well-defined interface — RAG implementation details never live inside
agents/"). This file is the ONLY place in `agents/` that imports `rag.*`.

`EvidenceRetriever.retrieve` takes a fully-formed `RetrievalQuery` — built by
the graph node from the Context Collector's payload and Tier 1's findings —
and returns an `EvidencePack`. No vector store, no embedding model and no
Chroma client type ever appears in a graph node's signature; they are
constructed once, behind `build_evidence_retriever`, exactly like
`agents/llm/provider.py`'s `build_provider`.

Until an authoritative source is actually ingested, the default is
`NotConfiguredEvidenceRetriever`: it never fabricates a citation in place of
a real one, and the Command Brief records that as a `NOT_CONFIGURED`
DataLimitation, same as before RAG existed."""

from __future__ import annotations

from typing import Protocol

from rag.schemas.models import ClaimMapping, EvidenceItem, EvidencePack, RetrievalQuery  # noqa: F401 — re-exported: this file is the only place in agents/ that imports rag.*

NOT_CONFIGURED = "NOT_CONFIGURED"


class EvidenceRetriever(Protocol):
    def retrieve(self, query: RetrievalQuery) -> EvidencePack: ...


class EvidenceRetrieverError(RuntimeError):
    pass


class NotConfiguredEvidenceRetriever:
    def retrieve(self, query: RetrievalQuery) -> EvidencePack:
        return EvidencePack(
            query=query.disaster_type,
            role=query.role,
            disaster_type=query.disaster_type,
            evidence_status="UNAVAILABLE",
            retriever_version="not-configured",
            limitation_code=NOT_CONFIGURED,
            note="No knowledge base is configured; regulatory/SOP citations are unavailable.",
        )


def build_evidence_retriever(
    name: str,
    *,
    persist_directory: str | None = None,
    embedding_provider_name: str = "local",
    relevance_threshold: float | None = None,
) -> EvidenceRetriever:
    """`name`: "none" (default; matches CLAUDE.md's original "no RAG yet"
    posture until real sources are ingested) or "chroma" (the real hybrid
    retriever over the `aquashield_evidence` collection)."""

    if name in ("none", "not_configured", ""):
        return NotConfiguredEvidenceRetriever()
    if name == "chroma":
        from rag.embeddings.provider import build_embedding_provider
        from rag.retrieval.retriever import DEFAULT_RELEVANCE_THRESHOLD, HybridRetriever
        from rag.vectorstore.chroma_store import ChromaVectorStore

        return HybridRetriever(
            vector_store=ChromaVectorStore(persist_directory=persist_directory),
            embedding_provider=build_embedding_provider(embedding_provider_name),
            relevance_threshold=relevance_threshold if relevance_threshold is not None else DEFAULT_RELEVANCE_THRESHOLD,
        )
    raise EvidenceRetrieverError(f"Unknown RAG provider {name!r} (expected 'none' or 'chroma').")
