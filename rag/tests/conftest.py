from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest

from rag.embeddings.provider import DeterministicHashEmbedding
from rag.retrieval.retriever import HybridRetriever
from rag.vectorstore.chroma_store import ChromaVectorStore

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture()
def vector_store(tmp_path):
    return ChromaVectorStore(persist_directory=tmp_path / "chroma")


@pytest.fixture()
def embedding_provider():
    return DeterministicHashEmbedding()


@pytest.fixture()
def hybrid_retriever(vector_store, embedding_provider):
    return HybridRetriever(vector_store=vector_store, embedding_provider=embedding_provider)


@pytest.fixture()
def ingested_store(vector_store, embedding_provider):
    """The two TEST_FIXTURE sources, fully ingested — what most retrieval
    tests build on."""

    from rag.pipelines.full_ingestion import ingest_all

    outcomes = ingest_all(
        FIXTURES_DIR, repo_root=REPO_ROOT, vector_store=vector_store, embedding_provider=embedding_provider, is_test_fixture=True
    )
    assert all(o.error is None for o in outcomes), outcomes
    return vector_store
