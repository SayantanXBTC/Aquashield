"""The read-only data surface the agents are allowed to touch.

`AnalysisDataAccess` is a Protocol the backend implements
(backend/app/services/ai_data_access.py) on top of its existing services —
Agent -> Tool -> Service -> Repository -> PostGIS/DB. The agents package
never imports SQLAlchemy, FastAPI or the backend; it only ever calls these
six bounded, read-only methods. Nothing here can write.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class ScenarioInfo:
    id: str
    name: str
    disaster_type: str
    status: str
    scenario_config: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RunInfo:
    id: str
    scenario_id: str
    status: str
    model_identifier: str | None
    frame_count: int | None


@dataclass(frozen=True)
class FrameRecord:
    frame_index: int
    timestep: int
    simulation_time: str | None
    hazard_state: dict[str, Any]
    infrastructure_impacts: list[dict[str, Any]]
    is_key_event: bool


@dataclass(frozen=True)
class FootprintRecord:
    frame_index: int
    geometry_type: str | None
    intensity: float | None
    intensity_units: str
    model_id: str
    is_demo_model: bool


@dataclass(frozen=True)
class ExposureRecord:
    asset_id: str
    asset_name: str
    asset_type: str
    criticality: str
    status: str
    distance_km: float | None


@dataclass(frozen=True)
class ExposureResult:
    data_quality: str  # available | partial | unavailable | unknown
    results: list[ExposureRecord]


class AnalysisDataAccess(Protocol):
    """Every method returns None / empty for "not found or not permitted";
    the tool layer turns that into DATA_UNAVAILABLE, never an invention."""

    def get_scenario(self, scenario_id: str) -> ScenarioInfo | None: ...

    def get_run(self, simulation_run_id: str) -> RunInfo | None: ...

    def get_frames(self, simulation_run_id: str, frame_index: int, window: int = 1) -> list[FrameRecord]:
        """Frames [frame_index - window, frame_index + window] — bounded, never the whole timeline."""
        ...

    def get_hazard_footprint(self, simulation_run_id: str, frame_index: int) -> FootprintRecord | None: ...

    def get_exposure(self, simulation_run_id: str, frame_index: int) -> ExposureResult: ...
