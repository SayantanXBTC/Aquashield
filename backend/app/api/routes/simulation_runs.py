from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models.simulation_run import SimulationRun
from app.db.session import get_db
from app.schemas.simulation import (
    SimulationArtifactOut,
    SimulationRunDetail,
    TimelineFrameOut,
    TimelineResponse,
)
from app.services.simulation_service import SimulationService

router = APIRouter(prefix="/simulation-runs", tags=["simulation"])


def get_simulation_service(db: Annotated[Session, Depends(get_db)]) -> SimulationService:
    return SimulationService(db)


SimulationServiceDep = Annotated[SimulationService, Depends(get_simulation_service)]


def _run_detail(service: SimulationService, run: SimulationRun) -> SimulationRunDetail:
    artifact = service.artifacts.get_latest_for_run(run.id)
    artifact_out = SimulationArtifactOut.model_validate(artifact) if artifact else None
    frame_count = artifact.extra_metadata.get("frame_count") if artifact else None
    return SimulationRunDetail(
        id=run.id,
        scenario_version_id=run.scenario_version_id,
        status=run.status,
        started_at=run.started_at,
        completed_at=run.completed_at,
        duration_seconds=run.duration_seconds,
        timestep_config=run.timestep_config,
        model_identifier=run.model_identifier,
        error_message=run.error_message,
        created_at=run.created_at,
        artifact=artifact_out,
        frame_count=frame_count,
    )


@router.get("/{run_id}", response_model=SimulationRunDetail)
def get_run(run_id: UUID, service: SimulationServiceDep) -> SimulationRunDetail:
    run = service.get_run(run_id)
    return _run_detail(service, run)


@router.post("/{run_id}/execute", response_model=SimulationRunDetail)
def execute_run(run_id: UUID, service: SimulationServiceDep) -> SimulationRunDetail:
    """Executes a pending run synchronously and returns its final metadata.
    Not a background job — see docs/development/simulation.md for why."""
    run = service.execute_run(run_id)
    return _run_detail(service, run)


@router.get("/{run_id}/timeline", response_model=TimelineResponse)
def get_timeline(run_id: UUID, service: SimulationServiceDep) -> TimelineResponse:
    run = service.get_run(run_id)
    frames = service.get_timeline(run_id)
    return TimelineResponse(
        simulation_run_id=run.id,
        frame_count=len(frames),
        frames=[TimelineFrameOut(**frame) for frame in frames],
    )
