from rag.retrieval.retriever import HybridRetriever
from rag.schemas.models import RetrievalQuery


def test_retrieves_relevant_evidence_for_the_right_disaster_type(ingested_store, embedding_provider):
    retriever = HybridRetriever(vector_store=ingested_store, embedding_provider=embedding_provider)
    pack = retriever.retrieve(RetrievalQuery(role="precaution", disaster_type="tsunami", hazard_summary="wave approaching coastline"))
    assert pack.evidence_status == "SUPPORTED"
    assert pack.items
    assert all(item.source_id == "test-fixture-tsunami-preparedness" for item in pack.items)
    assert all(item.trust_level == "TIER_1" for item in pack.items)
    assert all(0.0 <= item.relevance_score <= 1.0 for item in pack.items)
    # Ranked, not arbitrary order.
    scores = [item.relevance_score for item in pack.items]
    assert scores == sorted(scores, reverse=True) or len(set(scores)) < len(scores)


def test_never_crosses_disaster_type_boundaries(ingested_store, embedding_provider):
    # A cyclone query must never surface the tsunami-only source, though the
    # cross-cutting "general" source may legitimately appear alongside it.
    retriever = HybridRetriever(vector_store=ingested_store, embedding_provider=embedding_provider)
    pack = retriever.retrieve(RetrievalQuery(role="response", disaster_type="cyclone", hazard_summary="sustained wind speed forecast"))
    assert pack.evidence_status == "SUPPORTED"
    sources = {item.source_id for item in pack.items}
    assert "test-fixture-tsunami-preparedness" not in sources
    assert "test-fixture-cyclone-response" in sources


def test_below_threshold_is_insufficient_not_fabricated(ingested_store, embedding_provider):
    retriever = HybridRetriever(vector_store=ingested_store, embedding_provider=embedding_provider, relevance_threshold=0.99)
    pack = retriever.retrieve(RetrievalQuery(role="precaution", disaster_type="tsunami", hazard_summary="wave approaching coastline"))
    assert pack.evidence_status == "INSUFFICIENT_EVIDENCE"
    assert pack.items == []
    assert pack.limitation_code == "INSUFFICIENT_EVIDENCE"


def test_no_source_ingested_at_all_is_insufficient_evidence(vector_store, embedding_provider):
    # An empty knowledge base: the metadata filter matches nothing at all.
    retriever = HybridRetriever(vector_store=vector_store, embedding_provider=embedding_provider)
    pack = retriever.retrieve(RetrievalQuery(role="hazard", disaster_type="oil_spill", hazard_summary="slick concentration index rising"))
    assert pack.evidence_status == "INSUFFICIENT_EVIDENCE"
    assert "no authoritative source" in (pack.note or "").lower()


def test_ingested_but_off_topic_content_is_insufficient_not_forced(ingested_store, embedding_provider):
    # A source exists for this category (the general fixture always
    # matches), but nothing in it is actually relevant to this query.
    retriever = HybridRetriever(vector_store=ingested_store, embedding_provider=embedding_provider, relevance_threshold=0.9)
    pack = retriever.retrieve(RetrievalQuery(role="hazard", disaster_type="oil_spill", hazard_summary="slick concentration index rising"))
    assert pack.evidence_status == "INSUFFICIENT_EVIDENCE"
    assert pack.note == "Insufficient authoritative evidence retrieved."


def test_vector_store_outage_is_unavailable_not_a_crash(embedding_provider):
    class BrokenStore:
        def query(self, *a, **kw):
            raise RuntimeError("connection refused")

    retriever = HybridRetriever(vector_store=BrokenStore(), embedding_provider=embedding_provider)
    pack = retriever.retrieve(RetrievalQuery(role="hazard", disaster_type="flood"))
    assert pack.evidence_status == "UNAVAILABLE"
    assert pack.limitation_code == "RAG_UNAVAILABLE"


def test_role_scoped_queries_differ_in_phrasing(ingested_store, embedding_provider):
    retriever = HybridRetriever(vector_store=ingested_store, embedding_provider=embedding_provider)
    hazard_pack = retriever.retrieve(RetrievalQuery(role="hazard", disaster_type="tsunami"))
    precaution_pack = retriever.retrieve(RetrievalQuery(role="precaution", disaster_type="tsunami"))
    assert hazard_pack.query != precaution_pack.query


def test_evidence_ids_are_unique_and_stable_within_a_pack(ingested_store, embedding_provider):
    retriever = HybridRetriever(vector_store=ingested_store, embedding_provider=embedding_provider)
    pack = retriever.retrieve(RetrievalQuery(role="precaution", disaster_type="tsunami", hazard_summary="evacuation coastal warning", limit=10))
    ids = [item.evidence_id for item in pack.items]
    assert len(ids) == len(set(ids))
    assert all(i.startswith("RAG-") for i in ids)
