"""End-to-end ingestion of one document: parse -> chunk -> embed -> upsert.

Framework-free — no Postgres, no FastAPI. The idempotent "have we already
ingested this exact content" check needs a durable registry, which lives in
Postgres (`backend/app/db/models/rag_source.py`); this module only computes
the checksum and does the actual parse/chunk/embed/upsert work, so both the
CLI (`rag/__main__.py`, via the backend's `RagIngestionService`) and any
future direct caller get the identical pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rag.chunking.chunker import chunk_document
from rag.embeddings.provider import EmbeddingProvider
from rag.parsing.parsers import ParseError, parse_document
from rag.schemas.models import Chunk, SourceMetadata, checksum_of
from rag.vectorstore.chroma_store import ChromaVectorStore

REQUIRED_METADATA_FIELDS = ("source_id", "title", "publisher", "authority", "trust_level", "disaster_types")


class IngestionError(Exception):
    pass


@dataclass(frozen=True)
class IngestResult:
    source: SourceMetadata
    chunk_count: int
    skipped: bool
    """True when the checksum matched an already-ingested revision — no
    work was done, by design (idempotent re-ingestion)."""


def _validate_metadata(raw: dict[str, Any], *, path: Path) -> None:
    missing = [f for f in REQUIRED_METADATA_FIELDS if not raw.get(f)]
    if missing:
        raise IngestionError(f"{path}: source metadata is missing required field(s): {', '.join(missing)}.")


def build_source_metadata(path: Path, *, repo_root: Path, is_test_fixture: bool) -> tuple[SourceMetadata, str]:
    """Parses `path` and returns its `SourceMetadata` plus the raw text — the
    checksum is computed here so a caller can decide whether to skip
    ingestion BEFORE spending anything on chunking or embedding."""

    try:
        parsed = parse_document(path)
    except ParseError as exc:
        raise IngestionError(str(exc)) from exc
    _validate_metadata(parsed.metadata, path=path)
    raw = dict(parsed.metadata)
    checksum = checksum_of(parsed.text)
    resolved = path.resolve()
    try:
        file_path = str(resolved.relative_to(repo_root))
    except ValueError:
        # Outside the repo (e.g. a tmp directory in a test) — the absolute
        # path is still a meaningful audit trail, just not repo-relative.
        file_path = str(resolved)
    try:
        source = SourceMetadata(
            **{k: v for k, v in raw.items() if k in SourceMetadata.model_fields},
            checksum=checksum,
            file_path=file_path,
            is_test_fixture=is_test_fixture,
        )
    except Exception as exc:  # pydantic ValidationError
        raise IngestionError(f"{path}: invalid source metadata ({exc}).") from exc
    return source, parsed.text


def build_chunks(source: SourceMetadata, text: str) -> list[Chunk]:
    drafts = chunk_document(text)
    if not drafts:
        raise IngestionError(f"{source.source_id}: parsed to zero chunks (empty document?).")
    return [
        Chunk(
            chunk_id=f"{source.source_id}-{i}",
            source_id=source.source_id,
            document_id=source.source_id,
            text=draft.text,
            section=draft.section,
            page=draft.page,
            token_count=draft.token_count,
        )
        for i, draft in enumerate(drafts)
    ]


def ingest_chunks(
    source: SourceMetadata,
    chunks: list[Chunk],
    *,
    vector_store: ChromaVectorStore,
    embedding_provider: EmbeddingProvider,
) -> None:
    """Replaces the source's chunks wholesale — never appends duplicates
    across re-ingestions of a changed document."""

    vector_store.delete_source(source.source_id)
    embeddings = embedding_provider.embed([c.text for c in chunks])
    vector_store.upsert_chunks(chunks, embeddings, source=source)


def load_sidecar_or_frontmatter_only(path: Path) -> dict[str, Any]:
    """Used by `rag validate` to check a source's metadata without touching
    the vector store."""

    try:
        return dict(parse_document(path).metadata)
    except ParseError as exc:
        raise IngestionError(str(exc)) from exc
