"""/rag/* endpoints: source registry (unauthenticated, like /disaster-types
— sources are shared knowledge, not user data), direct retrieval (behind
auth), and health. `RAG_PROVIDER=chroma` end-to-end tests exercise the real
pipeline over the TEST_FIXTURE sources through a tmp_path-scoped Chroma
collection, never rag/vectorstore/data/ itself."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.conftest import requires_postgres

pytestmark = requires_postgres

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES_DIR = REPO_ROOT / "rag" / "tests" / "fixtures"


@pytest.fixture()
def ingested_fixtures(db_session, tmp_path):
    """Ingests the TEST_FIXTURE sources into a tmp_path-scoped Chroma
    collection and points settings at it for the duration of the test."""

    from app.config.settings import settings
    from app.services.rag_ingestion_service import RagIngestionService
    from app.services.rag_retrieval_service import reset_retriever_cache
    from rag.embeddings.provider import DeterministicHashEmbedding
    from rag.vectorstore.chroma_store import ChromaVectorStore

    vector_store = ChromaVectorStore(persist_directory=tmp_path / "chroma")
    service = RagIngestionService(db_session, vector_store=vector_store, embedding_provider=DeterministicHashEmbedding())
    logs = service.ingest_root(FIXTURES_DIR, is_test_fixture=True)
    db_session.commit()
    assert all(log.outcome == "ingested" for log in logs)

    original_provider = settings.rag_provider
    original_dir = settings.rag_vectorstore_dir_override
    settings.rag_provider = "chroma"
    settings.rag_vectorstore_dir_override = str(tmp_path / "chroma")
    reset_retriever_cache()
    yield
    settings.rag_provider = original_provider
    settings.rag_vectorstore_dir_override = original_dir
    reset_retriever_cache()


@pytest.fixture()
def not_configured():
    """Pins settings to the `RAG_PROVIDER=none` posture for the duration of
    the test, regardless of what a developer's local backend/.env has set
    for their own running server — the "not configured" behaviour is a
    property of the code's default, not of whoever's machine runs the
    suite (mirrors `ingested_fixtures` save/restore above)."""

    from app.config.settings import settings
    from app.services.rag_retrieval_service import reset_retriever_cache

    original_provider = settings.rag_provider
    settings.rag_provider = "none"
    reset_retriever_cache()
    yield
    settings.rag_provider = original_provider
    reset_retriever_cache()


def test_health_reports_not_configured_by_default(client, not_configured):
    response = client.get("/rag/health")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "none"
    assert body["configured"] is False
    assert body["source_count"] == 0


def test_sources_empty_before_anything_is_ingested(client):
    assert client.get("/rag/sources").json() == []


def test_unknown_source_is_404(client):
    assert client.get("/rag/sources/does-not-exist").status_code == 404


def test_retrieve_without_configuration_returns_unavailable(client, not_configured):
    response = client.post("/rag/retrieve", json={"role": "hazard", "disaster_type": "tsunami", "hazard_summary": "wave approaching"})
    assert response.status_code == 200
    body = response.json()
    assert body["evidence_status"] == "UNAVAILABLE"
    assert body["items"] == []
    assert body["limitation_code"] == "NOT_CONFIGURED"


def test_retrieve_requires_auth(db_session):
    # No `client` fixture — that fixture installs the test-only auth
    # override for its own lifetime; this asserts the real dependency
    # rejects an unauthenticated request (same pattern as
    # test_user_isolation.py::test_unauthenticated_request_is_rejected).
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as anonymous:
        response = anonymous.post("/rag/retrieve", json={"role": "hazard", "disaster_type": "tsunami"})
    assert response.status_code == 401


def test_sources_lists_registered_documents(client, ingested_fixtures):
    response = client.get("/rag/sources")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    by_id = {s["source_id"]: s for s in body}
    tsunami = by_id["test-fixture-tsunami-preparedness"]
    assert tsunami["trust_level"] == "TIER_1"
    assert tsunami["disaster_types"] == ["tsunami"]
    assert tsunami["is_test_fixture"] is True
    assert tsunami["chunk_count"] > 0


def test_sources_filters_by_disaster_type(client, ingested_fixtures):
    response = client.get("/rag/sources", params={"disaster_type": "cyclone"})
    body = response.json()
    assert {s["source_id"] for s in body} == {"test-fixture-cyclone-response"}


def test_get_one_source_by_source_id(client, ingested_fixtures):
    response = client.get("/rag/sources/test-fixture-general-coordination")
    assert response.status_code == 200
    assert response.json()["authority"] == "TEST_FIXTURE"


def test_health_reports_configured_with_chunk_count(client, ingested_fixtures):
    response = client.get("/rag/health")
    body = response.json()
    assert body["provider"] == "chroma"
    assert body["configured"] is True
    assert body["source_count"] == 3
    assert body["chunk_count"] is not None and body["chunk_count"] > 0


def test_retrieve_returns_real_grounded_evidence(client, ingested_fixtures):
    response = client.post(
        "/rag/retrieve",
        json={"role": "precaution", "disaster_type": "tsunami", "hazard_summary": "wave approaching coastal evacuation warning"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["evidence_status"] == "SUPPORTED"
    assert body["items"]
    assert all(item["source_id"] == "test-fixture-tsunami-preparedness" for item in body["items"])
    assert all(item["evidence_id"].startswith("RAG-") for item in body["items"])


def test_retrieve_off_topic_disaster_type_is_insufficient(client, ingested_fixtures):
    response = client.post("/rag/retrieve", json={"role": "hazard", "disaster_type": "oil_spill", "hazard_summary": "slick concentration"})
    assert response.status_code == 200
    assert response.json()["evidence_status"] == "INSUFFICIENT_EVIDENCE"
