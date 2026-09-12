"""Hybrid retrieval: embed the role-scoped query, filter by disaster-type
metadata, rank by cosine similarity, and reject anything under
`RAG_RELEVANCE_THRESHOLD`.

"Hybrid" here means vector similarity *plus* a metadata filter (disaster
type), not vector + keyword search — Chroma's cosine ranking already
degrades gracefully on vocabulary overlap (DeterministicHashEmbedding is
literally a bag-of-words vector), so a separate BM25 pass would add
complexity without changing which chunks come back for the sources this
pipeline actually has today. The seam is `HybridRetriever.retrieve` — a
second signal can be blended in there without touching any caller.
"""

from __future__ import annotations

from rag.embeddings.provider import EmbeddingProvider
from rag.schemas.models import EvidenceItem, EvidencePack, RetrievalQuery, TrustLevel
from rag.retrieval.query_builder import build_query_text
from rag.vectorstore.chroma_store import ChromaVectorStore

RETRIEVER_VERSION = "hybrid-chroma-v1"
DEFAULT_RELEVANCE_THRESHOLD = 0.15
NOT_ENOUGH_EVIDENCE = "INSUFFICIENT_EVIDENCE"
RETRIEVAL_UNAVAILABLE = "RAG_UNAVAILABLE"


class HybridRetriever:
    def __init__(
        self,
        *,
        vector_store: ChromaVectorStore,
        embedding_provider: EmbeddingProvider,
        relevance_threshold: float = DEFAULT_RELEVANCE_THRESHOLD,
    ) -> None:
        self.vector_store = vector_store
        self.embedding_provider = embedding_provider
        self.relevance_threshold = relevance_threshold

    def retrieve(self, query: RetrievalQuery) -> EvidencePack:
        query_text = build_query_text(query)
        try:
            embedding = self.embedding_provider.embed_one(query_text)
            rows = self.vector_store.query(
                embedding,
                disaster_types=[query.disaster_type, "general"],
                # Over-fetch so the threshold filter has real candidates to
                # reject from, rather than trivially passing whatever came
                # back first.
                top_k=max(query.limit * 3, 10),
            )
        except Exception as exc:  # noqa: BLE001 — a vector-store outage is UNAVAILABLE, never a 500
            return EvidencePack(
                query=query_text,
                role=query.role,
                disaster_type=query.disaster_type,
                evidence_status="UNAVAILABLE",
                retriever_version=RETRIEVER_VERSION,
                limitation_code=RETRIEVAL_UNAVAILABLE,
                note=f"Evidence retrieval failed: {type(exc).__name__}: {exc}"[:300],
            )

        candidates: list[EvidenceItem] = []
        for i, row in enumerate(rows):
            relevance = max(0.0, min(1.0, 1.0 - float(row["distance"])))
            if relevance < self.relevance_threshold:
                continue
            metadata = row["metadata"]
            candidates.append(
                EvidenceItem(
                    evidence_id=f"RAG-{metadata['source_id']}-{i}",
                    source_id=metadata["source_id"],
                    authority=metadata["authority"],
                    title=metadata["title"],
                    trust_level=metadata["trust_level"],  # type: ignore[arg-type]
                    section=metadata["section"] or None,
                    page=metadata["page"] or None,
                    url=metadata["url"] or None,
                    relevance_score=round(relevance, 4),
                    text_snippet=row["text"][:800],
                )
            )
        # Higher-trust sources rank first among comparably relevant chunks —
        # an official warning threshold outranks a secondary summary of it.
        items = _sorted_by_trust_then_relevance(candidates)[: query.limit]

        if not items:
            return EvidencePack(
                query=query_text,
                role=query.role,
                disaster_type=query.disaster_type,
                evidence_status=NOT_ENOUGH_EVIDENCE,
                retriever_version=RETRIEVER_VERSION,
                limitation_code=NOT_ENOUGH_EVIDENCE,
                note="Insufficient authoritative evidence retrieved."
                if rows
                else "No authoritative source is ingested for this disaster type yet.",
            )

        return EvidencePack(
            query=query_text,
            role=query.role,
            disaster_type=query.disaster_type,
            evidence_status="SUPPORTED",
            items=items,
            retriever_version=RETRIEVER_VERSION,
        )


def _sorted_by_trust_then_relevance(items: list[EvidenceItem]) -> list[EvidenceItem]:
    order: dict[TrustLevel, int] = {"TIER_1": 0, "TIER_2": 1, "TIER_3": 2, "TIER_4": 3}
    return sorted(items, key=lambda i: (order.get(i.trust_level, 9), -i.relevance_score))
