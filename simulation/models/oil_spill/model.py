"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a pollutant-dispersion model."""

from __future__ import annotations

import math
from typing import Any, ClassVar

from simulation.core.geo import circle_polygon, move_point
from simulation.core.model import DisasterModel


def _extract_latlon(point: dict[str, float] | None, fallback_lat: float, fallback_lon: float) -> tuple[float, float]:
    if not point:
        return fallback_lat, fallback_lon
    lat = point.get("latitude", point.get("lat"))
    lon = point.get("longitude", point.get("lon"))
    return (float(lat) if lat is not None else fallback_lat, float(lon) if lon is not None else fallback_lon)


class OilSpillModel(DisasterModel):
    model_identifier: ClassVar[str] = "oil-spill-demo-v1"
    disaster_type: ClassVar[str] = "oil_spill"
    assumptions: ClassVar[list[str]] = [
        "Drift velocity = surface current + 3% of wind speed (a commonly cited simplified windage factor) — not a hydrodynamic transport model.",
        "Slick area grows with elapsed time and spill volume; concentration decays exponentially (illustrative weathering) — not a real evaporation/emulsification model.",
    ]
    WINDAGE_FACTOR: ClassVar[float] = 0.03
    KT_TO_KMH: ClassVar[float] = 1.852

    def initialize(self) -> None:
        default_lat = self.location["latitude"] if self.location else 0.0
        default_lon = self.location["longitude"] if self.location else 0.0
        self.start_lat, self.start_lon = _extract_latlon(
            self.config.get("spill_location"), default_lat, default_lon
        )
        self.volume_tonnes = float(self.config.get("spill_volume_tonnes") or 10.0)
        self.oil_type = self.config.get("oil_type")
        self.wind_speed_kt = float(self.config.get("wind_speed_kt") or 0.0)
        self.wind_dir = float(self.config.get("wind_direction_deg") or 0.0)
        self.current_speed_kt = float(self.config.get("current_speed_kt") or 0.0)
        self.current_dir = float(self.config.get("current_direction_deg") or 0.0)
        self.lat, self.lon = self.start_lat, self.start_lon

    def step(self, timestep: int) -> None:
        elapsed_hours = self.clock.elapsed_hours_at(timestep)
        windage_kt = self.wind_speed_kt * self.WINDAGE_FACTOR
        drift_speed_kmh = (self.current_speed_kt + windage_kt) * self.KT_TO_KMH
        bearing = self.current_dir if self.current_speed_kt >= windage_kt else self.wind_dir
        distance_km = drift_speed_kmh * elapsed_hours
        self.lat, self.lon = move_point(self.start_lat, self.start_lon, bearing, distance_km)

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        elapsed_hours = self.clock.elapsed_hours_at(timestep)
        area_km2 = min(200.0, 0.5 * (self.volume_tonnes**0.5) * (1 + elapsed_hours))
        radius_km = math.sqrt(area_km2 / math.pi)
        concentration_index = math.exp(-0.15 * elapsed_hours)

        environmental_state = {
            "wind_speed_kt": self.wind_speed_kt,
            "wind_direction_deg": self.wind_dir,
            "current_speed_kt": self.current_speed_kt,
            "current_direction_deg": self.current_dir,
        }
        hazard_state = {
            "center": {"latitude": round(self.lat, 5), "longitude": round(self.lon, 5)},
            "slick_area_km2": round(area_km2, 3),
            "concentration_index": round(concentration_index, 4),
            "oil_type": self.oil_type,
        }
        affected_area = circle_polygon(self.lat, self.lon, radius_km)
        return environmental_state, hazard_state, affected_area
