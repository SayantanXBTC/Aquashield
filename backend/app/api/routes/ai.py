from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser
from app.db.models.ai_request import AIRequest
from app.db.session import get_db
from app.schemas.ai import AIAnalyzeRequest, AIRequestOut, AIRequestResultOut, AIRequestStatusOut, CommandBrief
from app.services.ai_analysis_service import AIAnalysisService

router = APIRouter(prefix="/ai", tags=["ai"])


def get_ai_service(db: Annotated[Session, Depends(get_db)], user: CurrentUser) -> AIAnalysisService:
    return AIAnalysisService(db, owner_uid=user.uid)


AIServiceDep = Annotated[AIAnalysisService, Depends(get_ai_service)]


def _out(request: AIRequest) -> AIRequestOut:
    return AIRequestOut.model_validate(request)


@router.post("/analyze", response_model=AIRequestOut, status_code=201)
def analyze(data: AIAnalyzeRequest, service: AIServiceDep) -> AIRequestOut:
    """Runs the analysis graph synchronously against one recorded frame and
    returns the audit record (poll /result for the brief). Read-only over
    simulation data; the only write is the ai_requests row."""
    return _out(service.analyze(data))


@router.post("/analyze-frame", response_model=AIRequestOut, status_code=201)
def analyze_frame(data: AIAnalyzeRequest, service: AIServiceDep) -> AIRequestOut:
    """The command center's frame-synchronised entry point (Prompt 15).

    Identical work to POST /analyze, but the caller is expected to send the
    `scenario_version_id` it is displaying and the `request_type` that
    triggered it (playback | scrub | paused | complete | manual). A version
    that no longer matches the run is refused as stale (409) instead of
    answered about a configuration the operator has moved on from.

    Milestones stream on the `/ws/ai` socket while this call is in flight."""

    return _out(service.analyze(data))


@router.get("/requests/{request_id}", response_model=AIRequestOut)
def get_request(request_id: UUID, service: AIServiceDep) -> AIRequestOut:
    return _out(service.get(request_id))


@router.get("/requests/{request_id}/status", response_model=AIRequestStatusOut)
def get_request_status(request_id: UUID, service: AIServiceDep) -> AIRequestStatusOut:
    request = service.get(request_id)
    return AIRequestStatusOut(id=request.id, status=request.status, execution_ms=request.execution_ms, error=request.error)


@router.get("/requests/{request_id}/result", response_model=AIRequestResultOut)
def get_request_result(request_id: UUID, service: AIServiceDep) -> AIRequestResultOut:
    request = service.get(request_id)
    brief = CommandBrief.model_validate(request.result) if request.result else None
    return AIRequestResultOut(id=request.id, status=request.status, result=brief, error=request.error)
