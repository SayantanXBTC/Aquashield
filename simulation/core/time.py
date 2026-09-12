"""Simulation clock — integer-minute arithmetic throughout to avoid the
floating-point time drift CLAUDE.md/Prompt 7 §8 warns against. A timestep
index is always an int; a simulation timestamp is always derived by adding
whole minutes to `start_time`, never by repeatedly adding a float delta."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from simulation.core.errors import SimulationConfigError

DEFAULT_TIMESTEP_MINUTES = 15
DEFAULT_DURATION_HOURS = 6.0


@dataclass(frozen=True)
class SimulationClock:
    start_time: datetime
    duration_minutes: int
    timestep_minutes: int

    def __post_init__(self) -> None:
        if self.timestep_minutes <= 0:
            raise SimulationConfigError("timestep_minutes must be > 0")
        if self.duration_minutes <= 0:
            raise SimulationConfigError("duration_minutes must be > 0")
        if self.duration_minutes % self.timestep_minutes != 0:
            raise SimulationConfigError(
                f"duration_minutes ({self.duration_minutes}) must be an exact multiple of "
                f"timestep_minutes ({self.timestep_minutes})"
            )

    @property
    def total_steps(self) -> int:
        return self.duration_minutes // self.timestep_minutes

    def timestamp_at(self, timestep: int) -> datetime:
        return self.start_time + timedelta(minutes=timestep * self.timestep_minutes)

    def elapsed_hours_at(self, timestep: int) -> float:
        return (timestep * self.timestep_minutes) / 60.0

    def progress_at(self, timestep: int) -> float:
        if self.total_steps == 0:
            return 1.0
        return min(1.0, timestep / self.total_steps)


def _parse_start_time(raw: Any) -> datetime:
    if raw is None:
        return datetime.now(timezone.utc)
    if isinstance(raw, datetime):
        start = raw
    else:
        start = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return start


def build_clock(scenario_config: dict[str, Any], timestep_config: dict[str, Any] | None) -> SimulationClock:
    """Builds a SimulationClock from a validated `scenario_config` (common
    `start_time`/`duration_hours` window — backend/app/schemas/scenario_config.py)
    and a run's `timestep_config` (`timestep_minutes`, optional).

    Duration is rounded DOWN to the nearest whole timestep rather than
    raising — a demo scenario with e.g. duration_hours=1.4 and a 15-minute
    timestep is a normal, not an erroneous, configuration."""
    start_time = _parse_start_time(scenario_config.get("start_time"))

    # `or` would silently treat an explicit 0 the same as "unset" and fall
    # back to the default — check for None instead, so an explicit invalid
    # value (0 or negative) reaches the validation below and raises.
    raw_duration_hours = scenario_config.get("duration_hours")
    duration_hours = raw_duration_hours if raw_duration_hours is not None else DEFAULT_DURATION_HOURS
    raw_timestep_minutes = (timestep_config or {}).get("timestep_minutes")
    timestep_minutes = int(raw_timestep_minutes) if raw_timestep_minutes is not None else DEFAULT_TIMESTEP_MINUTES
    if timestep_minutes <= 0:
        raise SimulationConfigError("timestep_minutes must be > 0")

    duration_minutes = int(round(float(duration_hours) * 60))
    if duration_minutes <= 0:
        raise SimulationConfigError("duration_hours must be > 0")

    remainder = duration_minutes % timestep_minutes
    if remainder:
        duration_minutes -= remainder
    if duration_minutes < timestep_minutes:
        duration_minutes = timestep_minutes

    return SimulationClock(
        start_time=start_time, duration_minutes=duration_minutes, timestep_minutes=timestep_minutes
    )
