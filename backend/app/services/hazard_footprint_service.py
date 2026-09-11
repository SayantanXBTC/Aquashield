"""Bridges the standalone simulation/ package's hazard-footprint repackaging
(simulation/core/hazard_footprint.py) into the backend: reads a run's
persisted timeline via SimulationService and converts each frame. No physics,
no new geometry computation — see simulation/core/hazard_footprint.py's
docstring."""

from __future__ import annotations

from uuid import UUID

from app.services.simulation_service import SimulationService

from simulation.core.hazard_footprint import HazardFootprint, build_hazard_footprint
from simulation.core.state import TimelineFrame


class HazardFootprintService:
    def __init__(self, simulation_service: SimulationService) -> None:
        self.simulation_service = simulation_service

    def get_footprints(self, run_id: UUID) -> list[HazardFootprint]:
        """One HazardFootprint per persisted TimelineFrame, in frame order.
        Empty list if the run hasn't been executed yet — never fabricated."""
        run = self.simulation_service.get_run(run_id)
        raw_frames = self.simulation_service.get_timeline(run_id)
        model_identifier = run.model_identifier or "unknown"
        footprints = []
        for raw in raw_frames:
            frame = TimelineFrame.from_dict(raw)
            footprints.append(build_hazard_footprint(frame, model_identifier=model_identifier))
        return footprints

    def get_footprint_for_frame(self, run_id: UUID, frame_index: int) -> HazardFootprint | None:
        for footprint in self.get_footprints(run_id):
            if footprint.frame_index == frame_index:
                return footprint
        return None

    def get_latest_footprint(self, run_id: UUID) -> HazardFootprint | None:
        footprints = self.get_footprints(run_id)
        return footprints[-1] if footprints else None
