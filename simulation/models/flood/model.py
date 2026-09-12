"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a hydraulic/hydrological model.

Runs in the demo shoreline world (simulation/core/propagation.py) as a
COASTAL flood: a surge front moves from the user-placed origin toward the
coast at `speed_kmh`; on arrival the water level rises to its peak over an
hour and pushes inland up to `spread_radius_km`, then recedes at a rate set
by `dispersion_rate`. Registered for flood / flash_flood / coastal_flood."""

from __future__ import annotations

import math
from typing import Any, ClassVar

from simulation.core.model import DisasterModel
from simulation.core.propagation import PropagationParams, front_state
from simulation.core.structures import HazardGeometry, assess_structures


class FloodModel(DisasterModel):
    model_identifier: ClassVar[str] = "coastal-flood-demo-v2"
    disaster_type: ClassVar[str] = "flood"
    assumptions: ClassVar[list[str]] = [
        "A surge front approaches the coast at a constant, user-set speed (default 40 km/h) along one heading — not a storm-surge model.",
        "Peak water level is 0.5 m + 5.5 m x intensity, reached 60 minutes after arrival with a smooth ramp — not a hydrograph.",
        "Inundation distance is spread_radius_km scaled by current level / peak level; the level recedes as exp(-0.3 x dispersion_rate x hours past peak) — not a terrain-aware flood extent.",
    ]
    DEFAULT_SPEED_KMH: ClassVar[float] = 40.0
    DEFAULT_SPREAD_KM: ClassVar[float] = 10.0
    RISE_MINUTES: ClassVar[float] = 60.0

    def initialize(self) -> None:
        self.params = PropagationParams.from_config(
            self.config,
            default_speed_kmh=self.DEFAULT_SPEED_KMH,
            default_spread_radius_km=self.DEFAULT_SPREAD_KM,
        )
        self.peak_level_m = 0.5 + 5.5 * self.params.intensity

    def step(self, timestep: int) -> None:
        pass

    def _front(self, timestep: int):
        return front_state(self.params, self.clock.elapsed_hours_at(timestep) * 60.0, stop_at_coast=True)

    def _level(self, front) -> float:
        since = front.minutes_since_arrival
        if not front.arrived:
            return 0.0
        if since <= self.RISE_MINUTES:
            t = since / self.RISE_MINUTES
            return self.peak_level_m * (t * t * (3.0 - 2.0 * t))  # smoothstep ramp
        past_peak_h = (since - self.RISE_MINUTES) / 60.0
        return self.peak_level_m * math.exp(-0.3 * self.params.dispersion_rate * past_peak_h)

    def get_infrastructure_impacts(self, timestep: int) -> list[dict[str, Any]]:
        front = self._front(timestep)
        level = self._level(front)
        ratio = 0.0 if self.peak_level_m <= 0 else level / self.peak_level_m
        geometry = HazardGeometry(
            kind="coastal_flood",
            origin_x_km=self.params.origin_x_km,
            origin_y_km=self.params.origin_y_km,
            position_x_km=front.position_x_km,
            position_y_km=front.position_y_km,
            heading_deg=self.params.heading_deg,
            arrived=front.arrived,
            coast_distance_total_km=front.coast_distance_total_km,
            traveled_km=front.traveled_km,
            spread_radius_km=self.params.spread_radius_km,
            inundation_km=self.params.spread_radius_km * ratio,
            scale=ratio,
        )
        return [i.to_dict() for i in assess_structures(self.config.get("structures"), geometry)]

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        front = self._front(timestep)
        since = front.minutes_since_arrival
        if not front.arrived:
            level = 0.0
        elif since <= self.RISE_MINUTES:
            t = since / self.RISE_MINUTES
            level = self.peak_level_m * (t * t * (3.0 - 2.0 * t))  # smoothstep ramp
        else:
            past_peak_h = (since - self.RISE_MINUTES) / 60.0
            level = self.peak_level_m * math.exp(-0.3 * self.params.dispersion_rate * past_peak_h)
        level_ratio = 0.0 if self.peak_level_m <= 0 else level / self.peak_level_m
        inundation_km = self.params.spread_radius_km * level_ratio

        hazard_state = {
            **front.to_hazard_state(self.params),
            "water_level_m": round(level, 3),
            "peak_level_m": round(self.peak_level_m, 3),
            "inundation_km": round(inundation_km, 3),
            "affected_radius_km": round(inundation_km, 3),
            "radius_km": round(inundation_km, 3),
        }
        return {}, hazard_state, None

    def is_key_event(self, timestep: int) -> bool:
        if timestep == 0:
            return False
        return (not self._front(timestep - 1).arrived) and self._front(timestep).arrived
