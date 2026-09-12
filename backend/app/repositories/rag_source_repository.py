from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.rag_source import RagIngestionLog, RagSource


class RagSourceRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_source_id(self, source_id: str) -> RagSource | None:
        stmt = select(RagSource).where(RagSource.source_id == source_id)
        return self.session.execute(stmt).scalar_one_or_none()

    def get(self, id_: UUID) -> RagSource | None:
        return self.session.get(RagSource, id_)

    def list_all(self, *, disaster_type: str | None = None) -> list[RagSource]:
        stmt = select(RagSource).order_by(RagSource.title)
        rows = list(self.session.execute(stmt).scalars().all())
        if disaster_type is None:
            return rows
        return [r for r in rows if disaster_type in r.disaster_types]

    def upsert(self, source: RagSource) -> RagSource:
        existing = self.get_by_source_id(source.source_id)
        if existing is None:
            self.session.add(source)
            self.session.flush()
            return source
        for field in ("title", "publisher", "authority", "trust_level", "disaster_types", "url", "publication_date", "checksum", "file_path", "chunk_count", "is_test_fixture", "ingested_at"):
            setattr(existing, field, getattr(source, field))
        self.session.flush()
        return existing

    def delete(self, source_id: str) -> bool:
        existing = self.get_by_source_id(source_id)
        if existing is None:
            return False
        self.session.delete(existing)
        self.session.flush()
        return True

    def add_log(self, log: RagIngestionLog) -> RagIngestionLog:
        self.session.add(log)
        self.session.flush()
        return log
