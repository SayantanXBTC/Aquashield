from pathlib import Path

import pytest

from rag.ingestion.pipeline import IngestionError, build_chunks, build_source_metadata
from rag.pipelines.full_ingestion import ingest_all
from rag.schemas.models import checksum_of

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
REPO_ROOT = Path(__file__).resolve().parents[2]


def test_build_source_metadata_from_fixture():
    source, text = build_source_metadata(FIXTURES_DIR / "tsunami-preparedness.md", repo_root=REPO_ROOT, is_test_fixture=True)
    assert source.source_id == "test-fixture-tsunami-preparedness"
    assert source.authority == "TEST_FIXTURE"
    assert source.trust_level == "TIER_1"
    assert source.disaster_types == ["tsunami"]
    assert source.checksum == checksum_of(text)
    assert source.is_test_fixture is True


def test_missing_required_field_is_rejected(tmp_path):
    path = tmp_path / "bad.md"
    path.write_text("---\ntitle: No source id\n---\n\nBody.\n")
    with pytest.raises(IngestionError, match="missing required field"):
        build_source_metadata(path, repo_root=REPO_ROOT, is_test_fixture=True)


def test_same_content_yields_same_checksum_different_content_does_not(tmp_path):
    a = tmp_path / "a.md"
    b = tmp_path / "b.md"
    frontmatter = "---\nsource_id: s\ntitle: T\npublisher: P\nauthority: A\ntrust_level: TIER_1\ndisaster_types: [general]\n---\n\n"
    a.write_text(frontmatter + "Identical body text.\n")
    b.write_text(frontmatter + "Identical body text.\n")
    c = tmp_path / "c.md"
    c.write_text(frontmatter + "A different body entirely.\n")
    source_a, text_a = build_source_metadata(a, repo_root=tmp_path, is_test_fixture=True)
    source_b, text_b = build_source_metadata(b, repo_root=tmp_path, is_test_fixture=True)
    source_c, text_c = build_source_metadata(c, repo_root=tmp_path, is_test_fixture=True)
    assert source_a.checksum == source_b.checksum
    assert source_a.checksum != source_c.checksum


def test_build_chunks_produces_provenance_matching_source():
    source, text = build_source_metadata(FIXTURES_DIR / "cyclone-response.md", repo_root=REPO_ROOT, is_test_fixture=True)
    chunks = build_chunks(source, text)
    assert len(chunks) >= 2
    assert all(c.source_id == source.source_id for c in chunks)
    assert all(c.chunk_id.startswith(source.source_id) for c in chunks)
    assert {c.section for c in chunks} >= {"Wind Field Monitoring", "Multi-Agency Coordination"}


def test_ingest_all_over_the_fixtures_directory(vector_store, embedding_provider):
    outcomes = ingest_all(FIXTURES_DIR, repo_root=REPO_ROOT, vector_store=vector_store, embedding_provider=embedding_provider, is_test_fixture=True)
    assert len(outcomes) == 3
    assert all(o.error is None for o in outcomes)
    assert vector_store.count() == sum(o.chunk_count for o in outcomes)


def test_reingesting_a_changed_document_replaces_its_chunks_not_duplicates(vector_store, embedding_provider, tmp_path):
    from rag.ingestion.pipeline import ingest_chunks

    frontmatter = "---\nsource_id: churn\ntitle: T\npublisher: P\nauthority: A\ntrust_level: TIER_2\ndisaster_types: [flood]\n---\n\n"
    path = tmp_path / "doc.md"
    path.write_text(frontmatter + ("Original content. " * 40) + "\n")
    source_v1, text_v1 = build_source_metadata(path, repo_root=tmp_path, is_test_fixture=True)
    ingest_chunks(source_v1, build_chunks(source_v1, text_v1), vector_store=vector_store, embedding_provider=embedding_provider)
    count_v1 = vector_store.count()
    assert count_v1 > 0

    path.write_text(frontmatter + ("Revised content is longer now. " * 60) + "\n")
    source_v2, text_v2 = build_source_metadata(path, repo_root=tmp_path, is_test_fixture=True)
    assert source_v2.checksum != source_v1.checksum
    ingest_chunks(source_v2, build_chunks(source_v2, text_v2), vector_store=vector_store, embedding_provider=embedding_provider)
    # Replaced, not appended: no leftover v1 chunks alongside the new ones.
    assert vector_store.count() == len(build_chunks(source_v2, text_v2))
