"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a tsunami-forecasting model.

Runs in the demo shoreline world (simulation/core/propagation.py): a wave
front expands from the user-placed origin along the configured heading at
`speed_kmh`, reaches the coast, then floods inland up to
`spread_radius_km * intensity`."""

from __future__ import annotations

from typing import Any, ClassVar

from simulation.core.model import DisasterModel
from simulation.core.propagation import PropagationParams, front_state
from simulation.core.structures import HazardGeometry, assess_structures


class TsunamiModel(DisasterModel):
    model_identifier: ClassVar[str] = "tsunami-demo-v2"
    disaster_type: ClassVar[str] = "tsunami"
    assumptions: ClassVar[list[str]] = [
        "The wave front travels at a constant, user-set speed (default 500 km/h) along one heading in a synthetic shoreline world.",
        "Initial wave height is 0.5 m + 9.5 m x intensity; height decays linearly by 35% over the approach — not a shoaling model.",
        "After landfall, inundation grows to spread_radius_km x intensity over 30 minutes, then holds — not an inundation model.",
    ]
    DEFAULT_SPEED_KMH: ClassVar[float] = 500.0
    DEFAULT_SPREAD_KM: ClassVar[float] = 12.0
    INUNDATION_RAMP_MIN: ClassVar[float] = 30.0

    def initialize(self) -> None:
        self.params = PropagationParams.from_config(
            self.config,
            default_speed_kmh=self.DEFAULT_SPEED_KMH,
            default_spread_radius_km=self.DEFAULT_SPREAD_KM,
        )
        self.initial_wave_height_m = 0.5 + 9.5 * self.params.intensity
        self.magnitude = self.config.get("magnitude")

    def step(self, timestep: int) -> None:
        # Stateless — every quantity derives from elapsed time in get_state().
        pass

    def _front(self, timestep: int):
        return front_state(self.params, self.clock.elapsed_hours_at(timestep) * 60.0, stop_at_coast=True)

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        front = self._front(timestep)
        wave_height_m = max(0.05, self.initial_wave_height_m * (1.0 - 0.35 * front.arrival_progress))
        ramp = min(1.0, front.minutes_since_arrival / self.INUNDATION_RAMP_MIN) if front.arrived else 0.0
        inundation_km = self.params.spread_radius_km * self.params.intensity * ramp
        coastal_impact_m = round(wave_height_m * front.arrival_progress, 3)

        hazard_state = {
            **front.to_hazard_state(self.params),
            "magnitude": self.magnitude,
            "wave_height_m": round(wave_height_m, 3),
            "front_radius_km": round(front.traveled_km, 3),
            "coastal_impact_m": coastal_impact_m,
            "inundation_km": round(inundation_km, 3),
            "radius_km": round(max(inundation_km, 0.0), 3),
        }
        return {}, hazard_state, None

    def get_infrastructure_impacts(self, timestep: int) -> list[dict[str, Any]]:
        front = self._front(timestep)
        ramp = min(1.0, front.minutes_since_arrival / self.INUNDATION_RAMP_MIN) if front.arrived else 0.0
        inundation_km = self.params.spread_radius_km * self.params.intensity * ramp
        wave_height_m = max(0.05, self.initial_wave_height_m * (1.0 - 0.35 * front.arrival_progress))
        geometry = HazardGeometry(
            kind="tsunami",
            origin_x_km=self.params.origin_x_km,
            origin_y_km=self.params.origin_y_km,
            position_x_km=front.position_x_km,
            position_y_km=front.position_y_km,
            heading_deg=self.params.heading_deg,
            arrived=front.arrived,
            coast_distance_total_km=front.coast_distance_total_km,
            traveled_km=front.traveled_km,
            spread_radius_km=self.params.spread_radius_km,
            inundation_km=inundation_km,
            scale=(wave_height_m * front.arrival_progress) / self.initial_wave_height_m,
        )
        return [i.to_dict() for i in assess_structures(self.config.get("structures"), geometry, self.params.shore)]

    def is_key_event(self, timestep: int) -> bool:
        """The frame where the wave first reaches the coast."""
        if timestep == 0:
            return False
        return (not self._front(timestep - 1).arrived) and self._front(timestep).arrived
