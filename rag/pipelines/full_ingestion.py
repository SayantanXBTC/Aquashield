"""Composes the ingestion pipeline over every source file under a root
directory. Pure `rag/` composition — no registry, no skip-if-unchanged
decision (that needs Postgres and lives in
`backend/app/services/rag_ingestion_service.py`, which calls
`ingest_one` per file after deciding whether the checksum actually changed).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from rag.embeddings.provider import EmbeddingProvider
from rag.ingestion.pipeline import IngestionError, build_chunks, build_source_metadata, ingest_chunks
from rag.metadata.discovery import discover_source_files
from rag.schemas.models import SourceMetadata
from rag.vectorstore.chroma_store import ChromaVectorStore


@dataclass(frozen=True)
class FileIngestOutcome:
    path: Path
    source: SourceMetadata | None
    chunk_count: int
    error: str | None


def ingest_one(
    path: Path,
    *,
    repo_root: Path,
    vector_store: ChromaVectorStore,
    embedding_provider: EmbeddingProvider,
    is_test_fixture: bool,
) -> FileIngestOutcome:
    try:
        source, text = build_source_metadata(path, repo_root=repo_root, is_test_fixture=is_test_fixture)
        chunks = build_chunks(source, text)
        ingest_chunks(source, chunks, vector_store=vector_store, embedding_provider=embedding_provider)
        return FileIngestOutcome(path=path, source=source, chunk_count=len(chunks), error=None)
    except IngestionError as exc:
        return FileIngestOutcome(path=path, source=None, chunk_count=0, error=str(exc))


def ingest_all(
    root: Path,
    *,
    repo_root: Path,
    vector_store: ChromaVectorStore,
    embedding_provider: EmbeddingProvider,
    is_test_fixture: bool,
) -> list[FileIngestOutcome]:
    return [
        ingest_one(path, repo_root=repo_root, vector_store=vector_store, embedding_provider=embedding_provider, is_test_fixture=is_test_fixture)
        for path in discover_source_files(root)
    ]
