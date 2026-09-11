"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a SAR probability-of-detection model."""

from __future__ import annotations

from typing import Any, ClassVar

from simulation.core.geo import circle_polygon, move_point
from simulation.core.model import DisasterModel


def _extract_latlon(point: dict[str, float] | None, fallback_lat: float, fallback_lon: float) -> tuple[float, float]:
    if not point:
        return fallback_lat, fallback_lon
    lat = point.get("latitude", point.get("lat"))
    lon = point.get("longitude", point.get("lon"))
    return (float(lat) if lat is not None else fallback_lat, float(lon) if lon is not None else fallback_lon)


class SearchRescueModel(DisasterModel):
    model_identifier: ClassVar[str] = "search-rescue-demo-v1"
    disaster_type: ClassVar[str] = "search_rescue"
    assumptions: ClassVar[list[str]] = [
        "Probable position drifts using the same simplified leeway+current approach as the oil spill model.",
        "Search radius grows over time to represent increasing position uncertainty — not a real SAR probability-of-detection model.",
    ]
    UNCERTAINTY_GROWTH_KM_PER_HR: ClassVar[float] = 1.5
    WINDAGE_FACTOR: ClassVar[float] = 0.03
    KT_TO_KMH: ClassVar[float] = 1.852

    def initialize(self) -> None:
        default_lat = self.location["latitude"] if self.location else 0.0
        default_lon = self.location["longitude"] if self.location else 0.0
        self.start_lat, self.start_lon = _extract_latlon(
            self.config.get("incident_location"), default_lat, default_lon
        )
        drift = self.config.get("drift_conditions") or {}
        self.current_speed_kt = float(drift.get("current_speed_kt") or 0.0)
        self.current_dir = float(drift.get("current_direction_deg") or 0.0)
        self.wind_speed_kt = float(drift.get("wind_speed_kt") or 0.0)
        self.wind_dir = float(drift.get("wind_direction_deg") or self.current_dir)
        self.initial_search_radius_km = float(self.config.get("search_radius_km") or 5.0)
        self.vessel_type = self.config.get("vessel_type")
        self.lat, self.lon = self.start_lat, self.start_lon

    def step(self, timestep: int) -> None:
        elapsed_hours = self.clock.elapsed_hours_at(timestep)
        drift_speed_kmh = (self.current_speed_kt + self.wind_speed_kt * self.WINDAGE_FACTOR) * self.KT_TO_KMH
        distance_km = drift_speed_kmh * elapsed_hours
        self.lat, self.lon = move_point(self.start_lat, self.start_lon, self.current_dir, distance_km)

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        elapsed_hours = self.clock.elapsed_hours_at(timestep)
        search_radius_km = self.initial_search_radius_km + self.UNCERTAINTY_GROWTH_KM_PER_HR * elapsed_hours
        confidence = max(0.1, 1.0 - 0.05 * elapsed_hours)

        environmental_state = {
            "current_speed_kt": self.current_speed_kt,
            "current_direction_deg": self.current_dir,
            "wind_speed_kt": self.wind_speed_kt,
            "vessel_type": self.vessel_type,
        }
        hazard_state = {
            "probable_center": {"latitude": round(self.lat, 5), "longitude": round(self.lon, 5)},
            "search_radius_km": round(search_radius_km, 3),
            "confidence": round(confidence, 3),
        }
        affected_area = circle_polygon(self.lat, self.lon, search_radius_km)
        return environmental_state, hazard_state, affected_area
