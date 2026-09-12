"""SimulationEngine — the disaster-agnostic driver: ScenarioVersion config in,
a time-ordered list of TimelineFrames out. No FastAPI, no SQLAlchemy, no
React/Three.js dependency (Prompt 7 §3/§24) — `backend/app/services/
simulation_service.py` is the only caller that knows this exists."""

from __future__ import annotations

from random import Random
from typing import Any
from uuid import UUID

from simulation.core.errors import SimulationExecutionError
from simulation.core.registry import get_model_class
from simulation.core.state import SimulationState, TimelineFrame
from simulation.core.time import SimulationClock, build_clock

DEFAULT_SEED = 0


class SimulationEngine:
    def __init__(
        self,
        *,
        simulation_run_id: UUID | str,
        disaster_type: str,
        scenario_config: dict[str, Any],
        timestep_config: dict[str, Any] | None = None,
        location: dict[str, float] | None = None,
        seed: int | None = None,
    ) -> None:
        self.simulation_run_id = str(simulation_run_id)
        self.disaster_type = disaster_type
        self.scenario_config = scenario_config or {}
        self.timestep_config = timestep_config or {}
        self.location = location
        self.seed = DEFAULT_SEED if seed is None else int(seed)

        # Validates config — raises SimulationConfigError for bad
        # timestep/duration or an unregistered disaster_type, before any
        # model code runs.
        self.clock: SimulationClock = build_clock(self.scenario_config, self.timestep_config)
        model_cls = get_model_class(disaster_type)
        self.model = model_cls(
            config=self.scenario_config,
            clock=self.clock,
            location=self.location,
            rng=Random(self.seed),
        )

        self.current_timestep = 0
        self.frames: list[TimelineFrame] = []
        self._initialized = False
        self._completed = False

    def initialize(self) -> None:
        if self._initialized:
            return
        try:
            self.model.initialize()
        except Exception as exc:  # model-authored setup failure — never swallowed
            raise SimulationExecutionError(
                f"{self.model.model_identifier} failed to initialize: {exc}"
            ) from exc
        self._initialized = True
        self._capture_frame(0)

    def step(self) -> TimelineFrame:
        if not self._initialized:
            raise SimulationExecutionError("engine.step() called before engine.initialize()")
        if self._completed:
            raise SimulationExecutionError("engine already completed — construct a new engine to re-run")
        self.current_timestep += 1
        try:
            self.model.step(self.current_timestep)
        except Exception as exc:
            raise SimulationExecutionError(
                f"{self.model.model_identifier} failed at timestep {self.current_timestep}: {exc}"
            ) from exc
        return self._capture_frame(self.current_timestep)

    def is_complete(self) -> bool:
        return self.model.is_complete(self.current_timestep)

    def run(self) -> list[TimelineFrame]:
        """Runs to completion deterministically: same disaster_type +
        scenario_config + timestep_config + seed always produces the same
        frames (Prompt 7 §9)."""
        self.initialize()
        while not self.is_complete():
            self.step()
        self._completed = True
        return self.frames

    def _capture_frame(self, timestep: int) -> TimelineFrame:
        environmental_state, hazard_state, affected_area = self.model.get_state(timestep)
        infrastructure_impacts = self.model.get_infrastructure_impacts(timestep)
        simulation_time = self.clock.timestamp_at(timestep)
        state = SimulationState(
            simulation_run_id=self.simulation_run_id,
            timestep=timestep,
            disaster_type=self.disaster_type,
            simulation_time=simulation_time,
            environmental_state=environmental_state,
            hazard_state=hazard_state,
            affected_area=affected_area,
            infrastructure_impacts=infrastructure_impacts,
            metadata={
                "model_identifier": self.model.model_identifier,
                "progress": self.clock.progress_at(timestep),
            },
        )
        is_key = (
            timestep == 0
            or timestep == self.clock.total_steps
            or self.model.is_key_event(timestep)
        )
        frame = TimelineFrame(
            simulation_run_id=self.simulation_run_id,
            timestep=timestep,
            simulation_time=simulation_time,
            state=state,
            is_key_event=is_key,
        )
        self.frames.append(frame)
        return frame
