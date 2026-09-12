"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a meteorological prediction model.

Runs in the demo shoreline world (simulation/core/propagation.py): the eye
moves from the user-placed origin along the configured heading at
`speed_kmh`, makes landfall, and keeps moving inland while its wind field
decays at a rate set by `dispersion_rate`."""

from __future__ import annotations

import math
from typing import Any, ClassVar

from simulation.core.model import DisasterModel
from simulation.core.propagation import PropagationParams, front_state
from simulation.core.structures import HazardGeometry, assess_structures


class CycloneModel(DisasterModel):
    model_identifier: ClassVar[str] = "cyclone-demo-v2"
    disaster_type: ClassVar[str] = "cyclone"
    assumptions: ClassVar[list[str]] = [
        "The eye moves at a constant, user-set speed (default 25 km/h) along one heading in a synthetic shoreline world.",
        "Peak wind is 35 kt + 125 kt x intensity; over land it decays as exp(-0.6 x dispersion_rate x hours inland) — not an intensity-forecast model.",
        "The wind-field radius is spread_radius_km (default 80 km) and does not change — not derived from pressure/wind physics.",
    ]
    DEFAULT_SPEED_KMH: ClassVar[float] = 25.0
    DEFAULT_SPREAD_KM: ClassVar[float] = 80.0

    def initialize(self) -> None:
        self.params = PropagationParams.from_config(
            self.config,
            default_speed_kmh=self.DEFAULT_SPEED_KMH,
            default_spread_radius_km=self.DEFAULT_SPREAD_KM,
        )
        self.peak_wind_kt = 35.0 + 125.0 * self.params.intensity
        self.central_pressure_hpa = self.config.get("central_pressure_hpa")

    def step(self, timestep: int) -> None:
        pass

    def _front(self, timestep: int):
        return front_state(self.params, self.clock.elapsed_hours_at(timestep) * 60.0, stop_at_coast=False)

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        front = self._front(timestep)
        hours_inland = front.minutes_since_arrival / 60.0
        decay = math.exp(-0.6 * self.params.dispersion_rate * hours_inland)
        wind_speed_kt = self.peak_wind_kt * decay

        hazard_state = {
            **front.to_hazard_state(self.params),
            "center": {"x": round(front.position_x_km, 3), "y": round(front.position_y_km, 3)},
            "central_pressure_hpa": self.central_pressure_hpa,
            "wind_speed_kt": round(wind_speed_kt, 2),
            "hazard_radius_km": round(self.params.spread_radius_km, 3),
            "radius_km": round(self.params.spread_radius_km, 3),
            "wind_decay": round(decay, 4),
        }
        return {}, hazard_state, None

    def get_infrastructure_impacts(self, timestep: int) -> list[dict[str, Any]]:
        front = self._front(timestep)
        decay = math.exp(-0.6 * self.params.dispersion_rate * (front.minutes_since_arrival / 60.0))
        geometry = HazardGeometry(
            kind="cyclone",
            origin_x_km=self.params.origin_x_km,
            origin_y_km=self.params.origin_y_km,
            position_x_km=front.position_x_km,
            position_y_km=front.position_y_km,
            heading_deg=self.params.heading_deg,
            arrived=front.arrived,
            coast_distance_total_km=front.coast_distance_total_km,
            traveled_km=front.traveled_km,
            spread_radius_km=self.params.spread_radius_km,
            radius_km=self.params.spread_radius_km,
            scale=min(1.0, self.peak_wind_kt * decay / 160.0),
        )
        return [i.to_dict() for i in assess_structures(self.config.get("structures"), geometry)]

    def is_key_event(self, timestep: int) -> bool:
        """The landfall frame."""
        if timestep == 0:
            return False
        return (not self._front(timestep - 1).arrived) and self._front(timestep).arrived
