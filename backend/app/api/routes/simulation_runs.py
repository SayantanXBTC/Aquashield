from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser
from app.db.models.simulation_run import SimulationRun
from app.db.session import get_db
from app.schemas.geospatial import (
    ExposureResponse,
    ExposureResultOut,
    HazardFootprintListResponse,
    HazardFootprintOut,
    ImpactFrameOut,
)
from app.schemas.simulation import (
    SimulationArtifactOut,
    SimulationRunDetail,
    TimelineFrameOut,
    TimelineResponse,
)
from app.services.exposure_service import ExposureService
from app.services.hazard_footprint_service import HazardFootprintService
from app.services.impact_service import ImpactFrameNotFoundError, ImpactService
from app.services.simulation_service import SimulationService

router = APIRouter(prefix="/simulation-runs", tags=["simulation"])


def get_simulation_service(db: Annotated[Session, Depends(get_db)], user: CurrentUser) -> SimulationService:
    return SimulationService(db, owner_uid=user.uid)


def get_hazard_footprint_service(
    simulation_service: Annotated[SimulationService, Depends(get_simulation_service)],
) -> HazardFootprintService:
    return HazardFootprintService(simulation_service)


def get_impact_service(db: Annotated[Session, Depends(get_db)], user: CurrentUser) -> ImpactService:
    return ImpactService(db, owner_uid=user.uid)


SimulationServiceDep = Annotated[SimulationService, Depends(get_simulation_service)]
HazardFootprintServiceDep = Annotated[HazardFootprintService, Depends(get_hazard_footprint_service)]
ImpactServiceDep = Annotated[ImpactService, Depends(get_impact_service)]


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


@router.get("/{run_id}/hazard-footprints", response_model=HazardFootprintListResponse)
def get_hazard_footprints(
    run_id: UUID, service: HazardFootprintServiceDep
) -> HazardFootprintListResponse:
    """One HazardFootprint per persisted TimelineFrame — a repackaging of
    hazard_state/affected_area (simulation/core/hazard_footprint.py), never a
    new physics computation. Empty list before the run is executed."""
    footprints = service.get_footprints(run_id)
    return HazardFootprintListResponse(
        simulation_run_id=run_id,
        frame_count=len(footprints),
        footprints=[HazardFootprintOut(**f.to_dict()) for f in footprints],
    )


@router.get("/{run_id}/exposure", response_model=ExposureResponse)
def get_exposure(
    run_id: UUID,
    hazard_footprints: HazardFootprintServiceDep,
    db: Annotated[Session, Depends(get_db)],
    frame_index: Annotated[int | None, Query(description="Defaults to the latest frame")] = None,
) -> ExposureResponse:
    """InfrastructureAsset rows intersecting or near the hazard footprint at
    `frame_index` (default: latest). "unavailable" data_quality (not a 404)
    when the run has no executed frames yet."""
    footprints = hazard_footprints.get_footprints(run_id)
    if not footprints:
        return ExposureResponse(
            simulation_run_id=run_id, frame_index=frame_index, data_quality="unavailable", exposure_results=[]
        )
    if frame_index is None:
        footprint = footprints[-1]
    else:
        matches = [f for f in footprints if f.frame_index == frame_index]
        if not matches:
            raise HTTPException(status_code=404, detail=f"No frame_index={frame_index} for run {run_id}")
        footprint = matches[0]

    if footprint.geometry is None:
        return ExposureResponse(
            simulation_run_id=run_id,
            frame_index=footprint.frame_index,
            data_quality="partial",
            exposure_results=[],
        )

    results = ExposureService(db).compute_exposure(footprint.geometry)
    return ExposureResponse(
        simulation_run_id=run_id,
        frame_index=footprint.frame_index,
        data_quality="available",
        exposure_results=[ExposureResultOut(**vars(r)) for r in results],
    )


@router.get("/{run_id}/impact", response_model=ImpactFrameOut)
def get_impact(run_id: UUID, service: ImpactServiceDep) -> ImpactFrameOut:
    """Impact summary (exposure + rule-based vulnerability, aggregated) for
    the latest available frame."""
    return ImpactFrameOut(**service.get_impact(run_id))


@router.get("/{run_id}/impact/frames/{frame_index}", response_model=ImpactFrameOut)
def get_impact_for_frame(run_id: UUID, frame_index: int, service: ImpactServiceDep) -> ImpactFrameOut:
    try:
        return ImpactFrameOut(**service.get_impact(run_id, frame_index))
    except ImpactFrameNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
