"""SIMPLIFIED DEMONSTRATION MODEL — see DisasterModel.describe() /
docs/development/simulation.md. Not a tsunami-forecasting model."""

from __future__ import annotations

from typing import Any, ClassVar

from simulation.core.geo import circle_polygon, haversine_km
from simulation.core.model import DisasterModel


class TsunamiModel(DisasterModel):
    model_identifier: ClassVar[str] = "tsunami-demo-v1"
    disaster_type: ClassVar[str] = "tsunami"
    assumptions: ClassVar[list[str]] = [
        "The wave travels from the source at a constant illustrative open-ocean speed (700 km/h).",
        "Wave height decays linearly with distance traveled relative to distance-to-coast.",
        "Coastal impact intensity is wave height scaled by arrival progress — not a real inundation model.",
    ]
    DEMO_WAVE_SPEED_KMH: ClassVar[float] = 700.0

    def initialize(self) -> None:
        default_lat = self.location["latitude"] if self.location else 0.0
        default_lon = self.location["longitude"] if self.location else 0.0
        source_lat = self.config.get("source_latitude")
        source_lon = self.config.get("source_longitude")
        self.source_lat = float(source_lat) if source_lat is not None else default_lat
        self.source_lon = float(source_lon) if source_lon is not None else default_lon
        self.initial_wave_height_m = float(self.config.get("initial_wave_height_m") or 1.0)
        self.magnitude = self.config.get("magnitude")
        self.coast = self.location or {"latitude": self.source_lat, "longitude": self.source_lon}
        self.distance_to_coast_km = max(
            haversine_km(self.source_lat, self.source_lon, self.coast["latitude"], self.coast["longitude"]),
            1.0,
        )

    def step(self, timestep: int) -> None:
        # Stateless: every quantity is derived directly from elapsed time in
        # get_state(), so there is nothing to mutate incrementally here.
        pass

    def _arrival_progress(self, timestep: int) -> float:
        elapsed_hours = self.clock.elapsed_hours_at(timestep)
        distance_traveled_km = self.DEMO_WAVE_SPEED_KMH * elapsed_hours
        return min(1.0, distance_traveled_km / self.distance_to_coast_km)

    def get_state(self, timestep: int) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]:
        elapsed_hours = self.clock.elapsed_hours_at(timestep)
        distance_traveled_km = min(self.DEMO_WAVE_SPEED_KMH * elapsed_hours, self.distance_to_coast_km)
        arrival_progress = self._arrival_progress(timestep)
        wave_height_m = max(0.05, self.initial_wave_height_m * (1 - 0.5 * arrival_progress))
        coastal_impact_m = round(wave_height_m * arrival_progress, 3)

        environmental_state: dict[str, Any] = {}
        hazard_state = {
            "magnitude": self.magnitude,
            "source": {"latitude": self.source_lat, "longitude": self.source_lon},
            "distance_traveled_km": round(distance_traveled_km, 2),
            "distance_to_coast_km": round(self.distance_to_coast_km, 2),
            "wave_height_m": round(wave_height_m, 3),
            "arrival_progress": round(arrival_progress, 4),
            "coastal_impact_m": coastal_impact_m,
        }
        impact_radius_km = 10.0 + coastal_impact_m * 20.0
        affected_area = (
            circle_polygon(self.coast["latitude"], self.coast["longitude"], impact_radius_km)
            if arrival_progress > 0
            else None
        )
        return environmental_state, hazard_state, affected_area

    def is_key_event(self, timestep: int) -> bool:
        """The frame where the wave first reaches the coast."""
        if timestep == 0:
            return False
        return self._arrival_progress(timestep - 1) < 1.0 <= self._arrival_progress(timestep)
