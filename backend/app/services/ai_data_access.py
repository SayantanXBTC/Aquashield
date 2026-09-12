"""Backend implementation of the agents' read-only data surface.

    Agent -> Tool -> (this adapter) -> Service -> Repository -> PostGIS/DB

Every method delegates to an existing, owner-scoped service; nothing here
issues SQL and nothing here writes. Queries are bounded by construction —
`get_frames` slices the recorded timeline to a window around one frame,
`get_exposure` is one frame's PostGIS intersection."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.services.exposure_service import ExposureService
from app.services.hazard_footprint_service import HazardFootprintService
from app.services.scenario_service import ScenarioNotFoundError, ScenarioService
from app.services.simulation_service import SimulationRunNotFoundError, SimulationService

from agents.tools.data_access import (
    ExposureRecord,
    ExposureResult,
    FootprintRecord,
    FrameRecord,
    RunInfo,
    ScenarioInfo,
)


def _uuid(value: str) -> UUID | None:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


class BackendAnalysisDataAccess:
    def __init__(self, session: Session, *, owner_uid: str) -> None:
        self.session = session
        self.owner_uid = owner_uid
        self.scenarios = ScenarioService(session, owner_uid=owner_uid)
        self.simulation = SimulationService(session, owner_uid=owner_uid)
        self.footprints = HazardFootprintService(self.simulation)
        self.exposure = ExposureService(session)

    def get_scenario(self, scenario_id: str) -> ScenarioInfo | None:
        sid = _uuid(scenario_id)
        if sid is None:
            return None
        try:
            scenario = self.scenarios.get_scenario(sid)
        except ScenarioNotFoundError:
            return None
        current = self.scenarios.scenarios.get_current_version(sid)
        return ScenarioInfo(
            id=str(scenario.id),
            name=scenario.name,
            disaster_type=scenario.disaster_type.value,
            status=scenario.status.value,
            scenario_config=dict(current.scenario_config) if current else {},
        )

    def get_run(self, simulation_run_id: str) -> RunInfo | None:
        rid = _uuid(simulation_run_id)
        if rid is None:
            return None
        try:
            run = self.simulation.get_run(rid)
        except SimulationRunNotFoundError:
            return None
        artifact = self.simulation.artifacts.get_latest_for_run(rid)
        frame_count = artifact.extra_metadata.get("frame_count") if artifact else None
        return RunInfo(
            id=str(run.id),
            scenario_id=str(run.scenario_version.scenario_id),
            status=run.status.value,
            model_identifier=run.model_identifier,
            frame_count=frame_count,
        )

    def get_frames(self, simulation_run_id: str, frame_index: int, window: int = 1) -> list[FrameRecord]:
        rid = _uuid(simulation_run_id)
        if rid is None:
            return []
        try:
            frames = self.simulation.get_timeline(rid)
        except SimulationRunNotFoundError:
            return []
        lo, hi = frame_index - window, frame_index + window
        out: list[FrameRecord] = []
        for index, frame in enumerate(frames):
            if index < lo or index > hi:
                continue
            state = frame.get("state") or {}
            out.append(
                FrameRecord(
                    frame_index=index,
                    timestep=int(frame.get("timestep", index)),
                    simulation_time=frame.get("simulation_time"),
                    hazard_state=dict(state.get("hazard_state") or {}),
                    infrastructure_impacts=list(state.get("infrastructure_impacts") or []),
                    is_key_event=bool(frame.get("is_key_event", False)),
                )
            )
        return out

    def get_hazard_footprint(self, simulation_run_id: str, frame_index: int) -> FootprintRecord | None:
        rid = _uuid(simulation_run_id)
        if rid is None:
            return None
        try:
            footprint = self.footprints.get_footprint_for_frame(rid, frame_index)
        except SimulationRunNotFoundError:
            return None
        if footprint is None:
            return None
        return FootprintRecord(
            frame_index=footprint.frame_index,
            geometry_type=footprint.geometry.get("type") if footprint.geometry else None,
            intensity=footprint.intensity,
            intensity_units=footprint.intensity_units,
            model_id=footprint.model_id,
            is_demo_model=footprint.is_demo_model,
        )

    def get_exposure(self, simulation_run_id: str, frame_index: int) -> ExposureResult:
        rid = _uuid(simulation_run_id)
        if rid is None:
            return ExposureResult(data_quality="unavailable", results=[])
        try:
            footprint = self.footprints.get_footprint_for_frame(rid, frame_index)
        except SimulationRunNotFoundError:
            return ExposureResult(data_quality="unavailable", results=[])
        if footprint is None:
            return ExposureResult(data_quality="unavailable", results=[])
        if footprint.geometry is None:
            return ExposureResult(data_quality="partial", results=[])
        results = self.exposure.compute_exposure(footprint.geometry)
        return ExposureResult(
            data_quality="available",
            results=[
                ExposureRecord(
                    asset_id=r.asset_id,
                    asset_name=r.asset_name,
                    asset_type=r.asset_type,
                    criticality=r.criticality,
                    status=r.status,
                    distance_km=r.distance_km,
                )
                for r in results
            ],
        )
