"""In-memory fakes for the agents' read-only data surface."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest

from agents.tools.data_access import ExposureRecord, ExposureResult, FootprintRecord, FrameRecord, RunInfo, ScenarioInfo


class FakeDataAccess:
    """A completed 9-frame tsunami run with one port that becomes impacted at
    frame 4, one asset exposure, and a footprint with no geometry."""

    def __init__(self, *, run_status: str = "completed", frame_count: int | None = 9, exposure_quality: str = "partial", fail_footprint: bool = False):
        self.run_status = run_status
        self.frame_count = frame_count
        self.exposure_quality = exposure_quality
        self.fail_footprint = fail_footprint
        self.calls: list[tuple[str, tuple]] = []

    def get_scenario(self, scenario_id):
        self.calls.append(("get_scenario", (scenario_id,)))
        if scenario_id == "missing":
            return None
        return ScenarioInfo(id=scenario_id, name="Demo Tsunami", disaster_type="tsunami", status="ready", scenario_config={"speed_kmh": 500.0, "intensity": 0.6, "spread_radius_km": 12.0})

    def get_run(self, run_id):
        self.calls.append(("get_run", (run_id,)))
        if run_id == "missing":
            return None
        return RunInfo(id=run_id, scenario_id="scn", status=self.run_status, model_identifier="tsunami-demo-v2", frame_count=self.frame_count)

    def get_frames(self, run_id, frame_index, window=1):
        self.calls.append(("get_frames", (run_id, frame_index, window)))
        frames = []
        for k in range(max(0, frame_index - window), min(8, frame_index + window) + 1):
            arrived = k >= 3
            frames.append(
                FrameRecord(
                    frame_index=k,
                    timestep=k,
                    simulation_time=f"2026-01-01T00:{k * 15:02d}:00+00:00",
                    hazard_state={
                        "phase": "inland" if arrived else "offshore",
                        "arrived": arrived,
                        "distance_to_coast_km": max(0.0, 121.55 - k * 41.0),
                        "eta_minutes": max(0.0, 14.6 - k * 5.0),
                        "wave_height_m": round(6.2 - k * 0.3, 3),
                        "inundation_km": 3.4 if k >= 4 else 0.0,
                    },
                    infrastructure_impacts=[
                        {"structure_id": "port", "structure_type": "port", "name": "Harbour", "distance_km": 2.1, "exposure": 0.61 if k >= 4 else 0.0, "status": "impacted" if k >= 4 else "clear"},
                        {"structure_id": "hosp", "structure_type": "hospital", "name": "Hospital", "distance_km": 12.0, "exposure": 0.0, "status": "clear"},
                    ],
                    is_key_event=k == 3,
                )
            )
        return frames

    def get_hazard_footprint(self, run_id, frame_index):
        self.calls.append(("get_hazard_footprint", (run_id, frame_index)))
        if self.fail_footprint:
            raise RuntimeError("PostGIS unreachable")
        return FootprintRecord(frame_index=frame_index, geometry_type=None, intensity=3.1, intensity_units="m", model_id="tsunami-demo-v2", is_demo_model=True)

    def get_exposure(self, run_id, frame_index):
        self.calls.append(("get_exposure", (run_id, frame_index)))
        if self.exposure_quality == "available":
            return ExposureResult(data_quality="available", results=[ExposureRecord(asset_id="asset-1", asset_name="Coastal Clinic", asset_type="hospital", criticality="critical", status="within_hazard_footprint", distance_km=0.0)])
        return ExposureResult(data_quality=self.exposure_quality, results=[])


@pytest.fixture
def fake_data():
    return FakeDataAccess()
