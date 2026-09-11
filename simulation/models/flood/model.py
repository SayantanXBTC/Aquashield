"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a hydraulic/hydrological model."""

from __future__ import annotations

from typing import Any, ClassVar

from simulation.core.geo import circle_polygon
from simulation.core.model import DisasterModel


class FloodModel(DisasterModel):
    model_identifier: ClassVar[str] = "flood-demo-v1"
    disaster_type: ClassVar[str] = "flood"
    assumptions: ClassVar[list[str]] = [
        "Water level rises linearly at a configured (or rainfall-derived) rate, reduced by drainage capacity.",
        "Affected radius is a linear function of the rise above the initial water level — not a terrain-aware flood extent.",
    ]

    def initialize(self) -> None:
        self.initial_level_m = float(self.config.get("river_level_m") or 0.0)
        self.rainfall_mm_24h = self.config.get("rainfall_mm_24h")
        configured_rate = self.config.get("water_rise_rate_m_per_hr")
        if configured_rate is not None:
            base_rate = float(configured_rate)
        elif self.rainfall_mm_24h:
            base_rate = float(self.rainfall_mm_24h) / 1000.0 * 2.0
        else:
            base_rate = 0.05
        drainage_pct = float(self.config.get("drainage_capacity_pct") or 0.0)
        self.rise_rate_m_per_hr = max(0.0, base_rate * (1 - drainage_pct / 100.0))
        self.water_level_m = self.initial_level_m

    def step(self, timestep: int) -> None:
        elapsed_hours = self.clock.elapsed_hours_at(timestep)
        self.water_level_m = self.initial_level_m + self.rise_rate_m_per_hr * elapsed_hours

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        rise_m = max(0.0, self.water_level_m - self.initial_level_m)
        affected_radius_km = rise_m * 5.0
        environmental_state = {
            "rainfall_mm_24h": self.rainfall_mm_24h,
            "drainage_capacity_pct": self.config.get("drainage_capacity_pct"),
        }
        hazard_state = {
            "water_level_m": round(self.water_level_m, 3),
            "rise_rate_m_per_hr": round(self.rise_rate_m_per_hr, 4),
            "affected_radius_km": round(affected_radius_km, 3),
        }
        affected_area = (
            circle_polygon(self.location["latitude"], self.location["longitude"], affected_radius_km)
            if self.location and affected_radius_km > 0
            else None
        )
        return environmental_state, hazard_state, affected_area
