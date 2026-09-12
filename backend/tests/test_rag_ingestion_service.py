"""RagIngestionService: the Postgres-side idempotency layer over rag/'s
framework-free ingestion pipeline."""

from __future__ import annotations

from pathlib import Path

import pytest

from tests.conftest import requires_postgres

from app.repositories.rag_source_repository import RagSourceRepository
from app.services.rag_ingestion_service import RagIngestionService

pytestmark = requires_postgres

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "rag" / "tests" / "fixtures"


@pytest.fixture()
def service(db_session, tmp_path):
    from rag.embeddings.provider import DeterministicHashEmbedding
    from rag.vectorstore.chroma_store import ChromaVectorStore

    return RagIngestionService(db_session, vector_store=ChromaVectorStore(persist_directory=tmp_path / "chroma"), embedding_provider=DeterministicHashEmbedding())


def test_ingest_root_registers_every_fixture(service, db_session):
    logs = service.ingest_root(FIXTURES_DIR, is_test_fixture=True)
    db_session.commit()
    assert {log.outcome for log in logs} == {"ingested"}
    assert len(logs) == 3
    repo = RagSourceRepository(db_session)
    rows = repo.list_all()
    assert len(rows) == 3
    assert all(r.is_test_fixture for r in rows)
    assert service.vector_store.count() == sum(r.chunk_count for r in rows)


def test_reingesting_unchanged_content_is_skipped(service, db_session):
    service.ingest_root(FIXTURES_DIR, is_test_fixture=True)
    db_session.commit()
    logs = service.ingest_root(FIXTURES_DIR, is_test_fixture=True)
    db_session.commit()
    assert {log.outcome for log in logs} == {"skipped"}
    # No chunks were re-embedded or duplicated.
    repo = RagSourceRepository(db_session)
    assert service.vector_store.count() == sum(r.chunk_count for r in repo.list_all())


def test_force_reingests_even_when_unchanged(service, db_session):
    service.ingest_root(FIXTURES_DIR, is_test_fixture=True)
    db_session.commit()
    logs = service.ingest_root(FIXTURES_DIR, is_test_fixture=True, force=True)
    db_session.commit()
    assert {log.outcome for log in logs} == {"ingested"}


def test_changed_content_replaces_the_registry_row_not_duplicates_it(service, db_session, tmp_path):
    frontmatter = "---\nsource_id: churn\ntitle: T\npublisher: P\nauthority: A\ntrust_level: TIER_2\ndisaster_types: [flood]\n---\n\n"
    path = tmp_path / "doc.md"
    path.write_text(frontmatter + ("Original content. " * 40) + "\n")
    service.ingest_path(path, is_test_fixture=True)
    db_session.commit()

    path.write_text(frontmatter + ("Revised and longer content. " * 60) + "\n")
    log = service.ingest_path(path, is_test_fixture=True)
    db_session.commit()
    assert log.outcome == "ingested"

    repo = RagSourceRepository(db_session)
    rows = [r for r in repo.list_all() if r.source_id == "churn"]
    assert len(rows) == 1  # replaced, not duplicated
    assert rows[0].chunk_count == log.chunk_count


def test_invalid_source_is_logged_as_failed_not_raised(service, db_session, tmp_path):
    bad = tmp_path / "bad.md"
    bad.write_text("---\ntitle: No source id\n---\n\nBody.\n")
    log = service.ingest_path(bad, is_test_fixture=True)
    db_session.commit()
    assert log.outcome == "failed"
    assert "missing required field" in (log.error or "")


def test_validate_root_reports_without_writing_anything(service, db_session, tmp_path):
    good = tmp_path / "good.md"
    good.write_text("---\nsource_id: v\ntitle: T\npublisher: P\nauthority: A\ntrust_level: TIER_3\ndisaster_types: [general]\n---\n\nBody text.\n")
    bad = tmp_path / "bad.md"
    bad.write_text("no frontmatter at all")
    results = service.validate_root(tmp_path)
    assert len(results) == 2
    errors = {path.name: error for path, error in results}
    assert errors["good.md"] is None
    assert errors["bad.md"] is not None
    repo = RagSourceRepository(db_session)
    assert repo.list_all() == []


def test_delete_source_removes_both_registry_row_and_chunks(service, db_session):
    service.ingest_root(FIXTURES_DIR, is_test_fixture=True)
    db_session.commit()
    before = service.vector_store.count()
    assert before > 0
    deleted = service.delete_source("test-fixture-tsunami-preparedness")
    db_session.commit()
    assert deleted is True
    repo = RagSourceRepository(db_session)
    assert repo.get_by_source_id("test-fixture-tsunami-preparedness") is None
    assert service.vector_store.count() < before
