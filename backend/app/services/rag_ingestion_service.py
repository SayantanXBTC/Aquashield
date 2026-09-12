"""Bridges the framework-free `rag/` ingestion pipeline to the Postgres
source registry — the same pattern `ai_data_access.py` uses for agents and
`simulation_service.py` uses for the simulation engine: the domain package
stays free of SQLAlchemy/FastAPI, and one backend service does the crossing.

This is also where the idempotent "skip if unchanged" decision is made —
`rag.ingestion.pipeline` always knows a source's checksum, but only this
service has anywhere durable to compare it against."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models.rag_source import RagIngestionLog, RagSource
from app.repositories.rag_source_repository import RagSourceRepository

from rag.embeddings.provider import EmbeddingProvider, build_embedding_provider
from rag.ingestion.pipeline import IngestionError, build_chunks, build_source_metadata, ingest_chunks
from rag.metadata.discovery import discover_source_files
from rag.schemas.models import SourceMetadata
from rag.vectorstore.chroma_store import ChromaVectorStore

REPO_ROOT = Path(__file__).resolve().parents[3]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RagSourceValidationError(Exception):
    pass


class RagIngestionService:
    def __init__(
        self,
        session: Session,
        *,
        vector_store: ChromaVectorStore | None = None,
        embedding_provider: EmbeddingProvider | None = None,
    ) -> None:
        self.session = session
        self.sources = RagSourceRepository(session)
        self.vector_store = vector_store or ChromaVectorStore()
        self.embedding_provider = embedding_provider or build_embedding_provider("local")

    def ingest_path(self, path: Path, *, is_test_fixture: bool, force: bool = False) -> RagIngestionLog:
        """Idempotent: a checksum that matches the current registry row is a
        `skipped` outcome, not re-ingested. `force=True` re-ingests
        regardless (used when a source's chunking/embedding logic itself
        changes, not just its content)."""

        try:
            source, text = build_source_metadata(path, repo_root=REPO_ROOT, is_test_fixture=is_test_fixture)
        except IngestionError as exc:
            return self.sources.add_log(RagIngestionLog(source_id=path.stem, file_path=str(path), outcome="failed", error=str(exc)))

        existing = self.sources.get_by_source_id(source.source_id)
        if existing is not None and existing.checksum == source.checksum and not force:
            return self.sources.add_log(
                RagIngestionLog(source_id=source.source_id, file_path=str(path), outcome="skipped", chunk_count=existing.chunk_count, rag_source_id=existing.id)
            )

        try:
            chunks = build_chunks(source, text)
            ingest_chunks(source, chunks, vector_store=self.vector_store, embedding_provider=self.embedding_provider)
        except IngestionError as exc:
            return self.sources.add_log(RagIngestionLog(source_id=source.source_id, file_path=str(path), outcome="failed", error=str(exc)))

        row = self.sources.upsert(
            RagSource(
                source_id=source.source_id,
                title=source.title,
                publisher=source.publisher,
                authority=source.authority,
                trust_level=source.trust_level,  # type: ignore[arg-type]
                disaster_types=list(source.disaster_types),
                url=source.url,
                publication_date=source.publication_date,
                checksum=source.checksum,
                file_path=source.file_path,
                chunk_count=len(chunks),
                is_test_fixture=source.is_test_fixture,
                ingested_at=_now(),
            )
        )
        return self.sources.add_log(
            RagIngestionLog(source_id=source.source_id, file_path=str(path), outcome="ingested", chunk_count=len(chunks), rag_source_id=row.id)
        )

    def ingest_root(self, root: Path, *, is_test_fixture: bool, force: bool = False) -> list[RagIngestionLog]:
        return [self.ingest_path(p, is_test_fixture=is_test_fixture, force=force) for p in discover_source_files(root)]

    def validate_root(self, root: Path) -> list[tuple[Path, str | None]]:
        """Parses every source under `root` and reports metadata errors
        without touching the vector store or the registry — `rag validate`."""

        from rag.ingestion.pipeline import load_sidecar_or_frontmatter_only

        results: list[tuple[Path, str | None]] = []
        for path in discover_source_files(root):
            try:
                build_source_metadata(path, repo_root=REPO_ROOT, is_test_fixture=True)
                results.append((path, None))
            except IngestionError as exc:
                results.append((path, str(exc)))
        return results

    def delete_source(self, source_id: str) -> bool:
        self.vector_store.delete_source(source_id)
        return self.sources.delete(source_id)
