"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a pollutant-dispersion model.

Runs in the demo shoreline world (simulation/core/propagation.py): the slick
centre drifts from the user-placed origin along the configured heading at
`speed_kmh` (a slow surface drift), beaches when it reaches the coast, and
spreads/thins at a rate set by `dispersion_rate`."""

from __future__ import annotations

import math
from typing import Any, ClassVar

from simulation.core.model import DisasterModel
from simulation.core.propagation import PropagationParams, front_state
from simulation.core.structures import HazardGeometry, assess_structures


class OilSpillModel(DisasterModel):
    model_identifier: ClassVar[str] = "oil-spill-demo-v2"
    disaster_type: ClassVar[str] = "oil_spill"
    assumptions: ClassVar[list[str]] = [
        "The slick centre drifts at a constant, user-set speed (default 3 km/h) along one heading and stops at the shoreline — not a hydrodynamic transport model.",
        "Slick radius grows toward spread_radius_km as 1 - exp(-(0.4 + 1.6 x dispersion_rate) x hours) — an illustrative spreading curve.",
        "Concentration index decays as exp(-0.35 x dispersion_rate x hours) — not an evaporation/emulsification model.",
    ]
    DEFAULT_SPEED_KMH: ClassVar[float] = 3.0
    DEFAULT_SPREAD_KM: ClassVar[float] = 18.0

    def initialize(self) -> None:
        self.params = PropagationParams.from_config(
            self.config,
            default_speed_kmh=self.DEFAULT_SPEED_KMH,
            default_spread_radius_km=self.DEFAULT_SPREAD_KM,
        )
        self.volume_tonnes = self.config.get("spill_volume_tonnes")
        self.oil_type = self.config.get("oil_type")

    def step(self, timestep: int) -> None:
        pass

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        hours = self.clock.elapsed_hours_at(timestep)
        front = front_state(self.params, hours * 60.0, stop_at_coast=True)
        growth = 1.0 - math.exp(-(0.4 + 1.6 * self.params.dispersion_rate) * hours)
        radius_km = 0.3 + self.params.spread_radius_km * growth
        concentration_index = math.exp(-0.35 * self.params.dispersion_rate * hours) * (0.35 + 0.65 * self.params.intensity)
        area_km2 = math.pi * radius_km * radius_km

        hazard_state = {
            **front.to_hazard_state(self.params),
            "center": {"x": round(front.position_x_km, 3), "y": round(front.position_y_km, 3)},
            "slick_radius_km": round(radius_km, 3),
            "slick_area_km2": round(area_km2, 3),
            "concentration_index": round(concentration_index, 4),
            "oil_type": self.oil_type,
            "spill_volume_tonnes": self.volume_tonnes,
            "beached": front.arrived,
            "radius_km": round(radius_km, 3),
        }
        return {}, hazard_state, None

    def get_infrastructure_impacts(self, timestep: int) -> list[dict[str, Any]]:
        hours = self.clock.elapsed_hours_at(timestep)
        front = front_state(self.params, hours * 60.0, stop_at_coast=True)
        growth = 1.0 - math.exp(-(0.4 + 1.6 * self.params.dispersion_rate) * hours)
        radius_km = 0.3 + self.params.spread_radius_km * growth
        concentration = math.exp(-0.35 * self.params.dispersion_rate * hours) * (0.35 + 0.65 * self.params.intensity)
        geometry = HazardGeometry(
            kind="oil_spill",
            origin_x_km=self.params.origin_x_km,
            origin_y_km=self.params.origin_y_km,
            position_x_km=front.position_x_km,
            position_y_km=front.position_y_km,
            heading_deg=self.params.heading_deg,
            arrived=front.arrived,
            coast_distance_total_km=front.coast_distance_total_km,
            traveled_km=front.traveled_km,
            spread_radius_km=self.params.spread_radius_km,
            radius_km=radius_km,
            scale=concentration,
        )
        return [i.to_dict() for i in assess_structures(self.config.get("structures"), geometry, self.params.shore)]

    def is_key_event(self, timestep: int) -> bool:
        """The frame where the slick first beaches."""
        if timestep == 0:
            return False
        prev = front_state(self.params, self.clock.elapsed_hours_at(timestep - 1) * 60.0, stop_at_coast=True)
        cur = front_state(self.params, self.clock.elapsed_hours_at(timestep) * 60.0, stop_at_coast=True)
        return (not prev.arrived) and cur.arrived
