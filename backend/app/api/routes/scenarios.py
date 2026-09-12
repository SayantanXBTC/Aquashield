from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app.db.geo import point_to_latlon
from app.db.models.enums import DisasterType, ScenarioStatus, SimulationStatus
from app.db.models.scenario import Scenario
from app.db.models.scenario_version import ScenarioVersion
from app.db.models.simulation_run import SimulationRun
from app.db.session import get_db
from app.schemas.scenario import (
    Page,
    ScenarioCreateRequest,
    ScenarioDetail,
    ScenarioListItem,
    ScenarioUpdateRequest,
    ScenarioVersionCreateRequest,
    ScenarioVersionOut,
    SimulationRunCreateRequest,
    SimulationRunOut,
)
from app.services.scenario_service import ScenarioService

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


def get_scenario_service(db: Annotated[Session, Depends(get_db)]) -> ScenarioService:
    return ScenarioService(db)


ScenarioServiceDep = Annotated[ScenarioService, Depends(get_scenario_service)]


def _version_out(version: ScenarioVersion) -> ScenarioVersionOut:
    return ScenarioVersionOut.model_validate(version)


def _list_item(scenario: Scenario, current_version_number: int | None) -> ScenarioListItem:
    latlon = point_to_latlon(scenario.location)
    return ScenarioListItem(
        id=scenario.id,
        name=scenario.name,
        disaster_type=scenario.disaster_type,
        status=scenario.status,
        location_name=scenario.location_name,
        latitude=latlon[0] if latlon else None,
        longitude=latlon[1] if latlon else None,
        current_version_number=current_version_number,
        updated_at=scenario.updated_at,
    )


def _detail(scenario: Scenario, current_version: ScenarioVersion | None, version_count: int) -> ScenarioDetail:
    latlon = point_to_latlon(scenario.location)
    return ScenarioDetail(
        id=scenario.id,
        name=scenario.name,
        description=scenario.description,
        disaster_type=scenario.disaster_type,
        status=scenario.status,
        location_name=scenario.location_name,
        latitude=latlon[0] if latlon else None,
        longitude=latlon[1] if latlon else None,
        created_by=scenario.created_by,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at,
        current_version=_version_out(current_version) if current_version else None,
        version_count=version_count,
    )


def _run_out(run: SimulationRun, frame_count: int | None = None) -> SimulationRunOut:
    out = SimulationRunOut.model_validate(run)
    out.frame_count = frame_count
    return out


@router.post("", response_model=ScenarioDetail, status_code=201)
def create_scenario(data: ScenarioCreateRequest, service: ScenarioServiceDep) -> ScenarioDetail:
    scenario = service.create_scenario(data)
    versions = service.list_versions(scenario.id)
    return _detail(scenario, versions[-1] if versions else None, len(versions))


@router.get("", response_model=Page[ScenarioListItem])
def list_scenarios(
    service: ScenarioServiceDep,
    disaster_type: DisasterType | None = None,
    status: ScenarioStatus | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[ScenarioListItem]:
    scenarios, total = service.list_scenarios(
        disaster_type=disaster_type,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    items = []
    for scenario in scenarios:
        current = service.scenarios.get_current_version(scenario.id)
        items.append(_list_item(scenario, current.version_number if current else None))
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/{scenario_id}", response_model=ScenarioDetail)
def get_scenario(scenario_id: UUID, service: ScenarioServiceDep) -> ScenarioDetail:
    scenario = service.get_scenario(scenario_id)
    versions = service.list_versions(scenario_id)
    return _detail(scenario, versions[-1] if versions else None, len(versions))


@router.patch("/{scenario_id}", response_model=ScenarioDetail)
def update_scenario(scenario_id: UUID, data: ScenarioUpdateRequest, service: ScenarioServiceDep) -> ScenarioDetail:
    scenario = service.update_scenario(scenario_id, data)
    versions = service.list_versions(scenario_id)
    return _detail(scenario, versions[-1] if versions else None, len(versions))


@router.delete("/{scenario_id}", response_model=ScenarioDetail)
def delete_scenario(scenario_id: UUID, service: ScenarioServiceDep) -> ScenarioDetail:
    """Archives the scenario (status=archived) rather than hard-deleting —
    see docs/development/scenarios.md for why."""
    scenario = service.archive_scenario(scenario_id)
    versions = service.list_versions(scenario_id)
    return _detail(scenario, versions[-1] if versions else None, len(versions))


@router.post("/{scenario_id}/duplicate", response_model=ScenarioDetail, status_code=201)
def duplicate_scenario(scenario_id: UUID, service: ScenarioServiceDep) -> ScenarioDetail:
    duplicate = service.duplicate_scenario(scenario_id)
    versions = service.list_versions(duplicate.id)
    return _detail(duplicate, versions[-1] if versions else None, len(versions))


@router.get("/{scenario_id}/versions", response_model=list[ScenarioVersionOut])
def list_versions(scenario_id: UUID, service: ScenarioServiceDep) -> list[ScenarioVersionOut]:
    return [_version_out(v) for v in service.list_versions(scenario_id)]


@router.post("/{scenario_id}/versions", response_model=ScenarioVersionOut, status_code=201)
def create_version(
    scenario_id: UUID, data: ScenarioVersionCreateRequest, service: ScenarioServiceDep
) -> ScenarioVersionOut:
    return _version_out(service.create_version(scenario_id, data))


@router.get("/{scenario_id}/runs", response_model=list[SimulationRunOut])
def list_runs(
    scenario_id: UUID, service: ScenarioServiceDep, status: SimulationStatus | None = None
) -> list[SimulationRunOut]:
    return [
        _run_out(r, service.get_run_frame_count(r.id))
        for r in service.list_simulation_runs(scenario_id, status=status)
    ]


@router.post("/{scenario_id}/runs", response_model=SimulationRunOut, status_code=201)
def create_run(
    scenario_id: UUID,
    service: ScenarioServiceDep,
    data: Annotated[SimulationRunCreateRequest, Body(default_factory=SimulationRunCreateRequest)],
) -> SimulationRunOut:
    run = service.create_simulation_run(scenario_id, data)
    return _run_out(run, service.get_run_frame_count(run.id))


@router.get("/{scenario_id}/runs/default", response_model=SimulationRunOut | None)
def get_default_run(scenario_id: UUID, service: ScenarioServiceDep) -> SimulationRunOut | None:
    """Prompt 10.1: the "best default" run to auto-select for this scenario
    (see app/services/scenario_service.py's get_default_run and
    app/services/run_selection.py for the priority rule) — never just the
    newest run regardless of status. Returns null (200, not 404) when no run
    qualifies; the Command Center then leaves nothing auto-selected and the
    user picks explicitly from the run selector."""
    run = service.get_default_run(scenario_id)
    if run is None:
        return None
    return _run_out(run, service.get_run_frame_count(run.id))
