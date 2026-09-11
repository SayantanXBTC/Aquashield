"""In-memory state representations produced by the engine. Field names match
shared/contracts/simulation_state.schema.json and timeline_frame.schema.json
(architecture.md §22) — plain dataclasses here, not the Pydantic mirror in
shared/schemas/python/contracts.py, so this package stays a dependency-light
standalone module (CLAUDE.md §16/§17) usable without importing shared/.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class SimulationState:
    simulation_run_id: str
    timestep: int
    disaster_type: str
    simulation_time: datetime | None = None
    environmental_state: dict[str, Any] = field(default_factory=dict)
    hazard_state: dict[str, Any] = field(default_factory=dict)
    affected_area: dict[str, Any] | None = None
    # Empty until the future risk engine exists (Prompt 10) — this engine
    # only exposes raw hazard/environmental data, never a risk conclusion
    # (CLAUDE.md §5).
    risk_state: dict[str, Any] = field(default_factory=dict)
    infrastructure_impacts: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "simulation_run_id": self.simulation_run_id,
            "timestep": self.timestep,
            "disaster_type": self.disaster_type,
            "simulation_time": self.simulation_time.isoformat() if self.simulation_time else None,
            "environmental_state": self.environmental_state,
            "hazard_state": self.hazard_state,
            "affected_area": self.affected_area,
            "risk_state": self.risk_state,
            "infrastructure_impacts": self.infrastructure_impacts,
            "metadata": self.metadata,
        }


@dataclass
class TimelineFrame:
    simulation_run_id: str
    timestep: int
    simulation_time: datetime | None
    state: SimulationState
    is_key_event: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "simulation_run_id": self.simulation_run_id,
            "timestep": self.timestep,
            "simulation_time": self.simulation_time.isoformat() if self.simulation_time else None,
            "state": self.state.to_dict(),
            "is_key_event": self.is_key_event,
        }
