from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser
from app.db.session import get_db
from app.repositories.rag_source_repository import RagSourceRepository
from app.schemas.rag import EvidencePack, RagHealthOut, RagRetrieveRequest, RagSourceOut, RetrievalQuery
from app.services.rag_retrieval_service import RagRetrievalService, get_retriever

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/retrieve", response_model=EvidencePack)
def retrieve(data: RagRetrieveRequest, _user: CurrentUser) -> EvidencePack:
    """Exercises the hybrid retriever directly — the same call the analysis
    graph's evidence_retrieval node makes, outside a full AI run. Read-only;
    never writes, never fabricates a citation for a low-confidence result."""

    query = RetrievalQuery(
        role=data.role,
        disaster_type=data.disaster_type,
        hazard_summary=data.hazard_summary,
        impacted_asset_types=data.impacted_asset_types,
        operator_question=data.operator_question,
        limit=data.limit,
    )
    return RagRetrievalService().retrieve(query)


@router.get("/sources", response_model=list[RagSourceOut])
def list_sources(db: Annotated[Session, Depends(get_db)], disaster_type: str | None = None) -> list[RagSourceOut]:
    """Discovery aid, like GET /disaster-types — the authoritative-source
    registry, not owner-scoped (sources are shared knowledge, not user
    data)."""

    repo = RagSourceRepository(db)
    return [RagSourceOut.model_validate(s) for s in repo.list_all(disaster_type=disaster_type)]


@router.get("/sources/{source_id}", response_model=RagSourceOut)
def get_source(source_id: str, db: Annotated[Session, Depends(get_db)]) -> RagSourceOut:
    repo = RagSourceRepository(db)
    source = repo.get_by_source_id(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail=f"RAG source {source_id!r} not found")
    return RagSourceOut.model_validate(source)


@router.get("/health", response_model=RagHealthOut)
def health(db: Annotated[Session, Depends(get_db)]) -> RagHealthOut:
    """Whether the RAG layer can actually answer anything right now — the
    provider configured, whether any source is ingested, and (when
    configured) how many chunks the vector store holds."""

    from app.config.settings import settings

    repo = RagSourceRepository(db)
    sources = repo.list_all()
    chunk_count: int | None = None
    if settings.rag_provider == "chroma":
        retriever = get_retriever()
        vector_store = getattr(retriever, "vector_store", None)
        if vector_store is not None:
            chunk_count = vector_store.count()
    return RagHealthOut(
        provider=settings.rag_provider,
        configured=settings.rag_provider != "none",
        source_count=len(sources),
        chunk_count=chunk_count,
    )
