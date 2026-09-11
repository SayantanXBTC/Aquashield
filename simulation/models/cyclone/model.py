"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a meteorological prediction model."""

from __future__ import annotations

from typing import Any, ClassVar

from simulation.core.geo import circle_polygon, move_point
from simulation.core.model import DisasterModel


class CycloneModel(DisasterModel):
    model_identifier: ClassVar[str] = "cyclone-demo-v1"
    disaster_type: ClassVar[str] = "cyclone"
    assumptions: ClassVar[list[str]] = [
        "Without a track, the center moves at a fixed demo bearing (315°/northwest) and speed (15 km/h).",
        "With a track (list of {latitude, longitude}), the center is linearly interpolated across it by run progress.",
        "Wind speed decays linearly to 60% of its initial value over the run — not an intensity-forecast model.",
        "Hazard radius grows slowly over time to represent an expanding wind field — not derived from pressure/wind physics.",
    ]
    DEMO_SPEED_KMH: ClassVar[float] = 15.0
    DEMO_BEARING_DEG: ClassVar[float] = 315.0

    def initialize(self) -> None:
        self.start_lat = self.location["latitude"] if self.location else 0.0
        self.start_lon = self.location["longitude"] if self.location else 0.0
        self.wind_speed_kt = float(self.config.get("wind_speed_kt") or 60.0)
        self.central_pressure_hpa = self.config.get("central_pressure_hpa")
        self.radius_km = float(self.config.get("radius_km") or 50.0)
        self.track = self.config.get("track") or None
        if self.track:
            self.center_lat, self.center_lon = self._interpolate_track(0.0)
        else:
            self.center_lat, self.center_lon = self.start_lat, self.start_lon

    def _interpolate_track(self, progress: float) -> tuple[float, float]:
        points = self.track
        if len(points) == 1:
            return float(points[0]["latitude"]), float(points[0]["longitude"])
        position = progress * (len(points) - 1)
        index = min(int(position), len(points) - 2)
        frac = position - index
        lat = points[index]["latitude"] + (points[index + 1]["latitude"] - points[index]["latitude"]) * frac
        lon = points[index]["longitude"] + (points[index + 1]["longitude"] - points[index]["longitude"]) * frac
        return float(lat), float(lon)

    def step(self, timestep: int) -> None:
        progress = self.clock.progress_at(timestep)
        if self.track:
            self.center_lat, self.center_lon = self._interpolate_track(progress)
        else:
            elapsed_hours = self.clock.elapsed_hours_at(timestep)
            distance_km = self.DEMO_SPEED_KMH * elapsed_hours
            self.center_lat, self.center_lon = move_point(
                self.start_lat, self.start_lon, self.DEMO_BEARING_DEG, distance_km
            )

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        progress = self.clock.progress_at(timestep)
        wind_speed_now_kt = self.wind_speed_kt * (1 - 0.4 * progress)
        hazard_radius_km = self.radius_km * (1 + 0.3 * progress)

        environmental_state = {"central_pressure_hpa": self.central_pressure_hpa}
        hazard_state = {
            "center": {"latitude": round(self.center_lat, 5), "longitude": round(self.center_lon, 5)},
            "wind_speed_kt": round(wind_speed_now_kt, 2),
            "hazard_radius_km": round(hazard_radius_km, 2),
        }
        affected_area = circle_polygon(self.center_lat, self.center_lon, hazard_radius_km)
        return environmental_state, hazard_state, affected_area
