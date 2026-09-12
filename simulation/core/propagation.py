"""Demo shoreline world + propagation kinematics shared by every disaster
model. SIMPLIFIED DEMONSTRATION geometry — not a coastline, not bathymetry,
not a transport model (CLAUDE.md §26).

THE WORLD. A 300 km x 300 km square, coordinates in kilometres with +x east
and +y north. Ocean lies west of the shoreline, land east of it. The
shoreline is an analytic curve `shore_x(y)`: a base longitude plus three
sine terms (constants in `SHORE_TERMS`). Nothing about it is random — the
same function is mirrored line-for-line in
`frontend/src/propagation/world.ts`, and `shared/fixtures/propagation_cases.json`
pins sample outputs so the two can't drift (frontend/src/propagation/
mirror.test.ts checks them).

THE KINEMATICS. Every hazard has an `origin` on the water, a compass
`heading_deg` (0 = north, 90 = east), a `speed_kmh`, an `intensity` in
[0, 1], a `spread_radius_km` and a `dispersion_rate` in [0, 1]. `front_state`
advances a point from the origin along the heading and reports how far the
coast is along that heading, the ETA, and whether landfall has happened.
Disaster models layer their own (documented, illustrative) formulas on top.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

WORLD_KM = 300.0
WORLD_ID = "demo-shoreline-v1"

# shore_x(y) = SHORE_BASE_X_KM + Σ amp * sin(2π * freq * y / WORLD_KM + phase)
SHORE_BASE_X_KM = 196.0
SHORE_TERMS: tuple[tuple[float, float, float], ...] = (
    (14.0, 1.0, 0.6),
    (7.0, 2.3, 2.1),
    (3.0, 5.1, 4.0),
)

# Marching step used to find where a heading line meets the shoreline.
_MARCH_STEP_KM = 0.5
_MARCH_MAX_KM = WORLD_KM * 1.5

DEFAULT_ORIGIN_X_KM = 70.0
DEFAULT_ORIGIN_Y_KM = 150.0
DEFAULT_HEADING_DEG = 90.0
DEFAULT_INTENSITY = 0.6
DEFAULT_DISPERSION = 0.3


def shore_x(y_km: float) -> float:
    """East-west position of the shoreline at northing `y_km`."""
    x = SHORE_BASE_X_KM
    for amp, freq, phase in SHORE_TERMS:
        x += amp * math.sin(2.0 * math.pi * freq * y_km / WORLD_KM + phase)
    return x


def is_land(x_km: float, y_km: float) -> bool:
    return x_km >= shore_x(y_km)


def heading_vector(heading_deg: float) -> tuple[float, float]:
    """Compass heading -> unit (dx, dy): 0° = +y (north), 90° = +x (east)."""
    rad = math.radians(heading_deg)
    return math.sin(rad), math.cos(rad)


def distance_to_coast_along_heading(x_km: float, y_km: float, heading_deg: float) -> float | None:
    """Distance from (x, y) to the first land point along `heading_deg`, or
    None if that line never reaches land within the world. 0.0 if the start
    point is already on land."""
    if is_land(x_km, y_km):
        return 0.0
    dx, dy = heading_vector(heading_deg)
    traveled = 0.0
    while traveled < _MARCH_MAX_KM:
        nxt = traveled + _MARCH_STEP_KM
        px, py = x_km + dx * nxt, y_km + dy * nxt
        if is_land(px, py):
            # Bisect the last step so the result is accurate to ~1 m.
            lo, hi = traveled, nxt
            for _ in range(12):
                mid = 0.5 * (lo + hi)
                if is_land(x_km + dx * mid, y_km + dy * mid):
                    hi = mid
                else:
                    lo = mid
            return round(hi, 4)
        traveled = nxt
    return None


def nearest_shore_distance(x_km: float, y_km: float) -> float:
    """Straight-line distance to the closest shoreline sample within ±80 km
    of northing; 0 on land. Telemetry only."""
    if is_land(x_km, y_km):
        return 0.0
    best = float("inf")
    y0 = y_km - 80.0
    for i in range(161):
        yi = y0 + i
        d = math.hypot(shore_x(yi) - x_km, yi - y_km)
        if d < best:
            best = d
    return round(best, 4)


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


@dataclass(frozen=True)
class PropagationParams:
    origin_x_km: float
    origin_y_km: float
    heading_deg: float
    speed_kmh: float
    intensity: float
    spread_radius_km: float
    dispersion_rate: float

    @classmethod
    def from_config(
        cls,
        config: dict[str, Any],
        *,
        default_speed_kmh: float,
        default_spread_radius_km: float,
    ) -> "PropagationParams":
        def num(key: str, default: float) -> float:
            raw = config.get(key)
            return float(raw) if raw is not None else default

        return cls(
            origin_x_km=clamp(num("origin_x_km", DEFAULT_ORIGIN_X_KM), 0.0, WORLD_KM),
            origin_y_km=clamp(num("origin_y_km", DEFAULT_ORIGIN_Y_KM), 0.0, WORLD_KM),
            heading_deg=num("heading_deg", DEFAULT_HEADING_DEG) % 360.0,
            speed_kmh=max(0.1, num("speed_kmh", default_speed_kmh)),
            intensity=clamp(num("intensity", DEFAULT_INTENSITY), 0.0, 1.0),
            spread_radius_km=max(0.0, num("spread_radius_km", default_spread_radius_km)),
            dispersion_rate=clamp(num("dispersion_rate", DEFAULT_DISPERSION), 0.0, 1.0),
        )


@dataclass(frozen=True)
class FrontState:
    elapsed_minutes: float
    traveled_km: float
    position_x_km: float
    position_y_km: float
    coast_distance_total_km: float | None
    distance_to_coast_km: float | None
    arrival_progress: float
    arrived: bool
    eta_minutes: float | None
    minutes_since_arrival: float

    def to_hazard_state(self, params: PropagationParams) -> dict[str, Any]:
        """The disaster-agnostic part of every `hazard_state` — the keys the
        Command Center telemetry reads regardless of disaster type."""
        return {
            "world": WORLD_ID,
            "origin_km": {"x": round(params.origin_x_km, 3), "y": round(params.origin_y_km, 3)},
            "position_km": {"x": round(self.position_x_km, 3), "y": round(self.position_y_km, 3)},
            "heading_deg": round(params.heading_deg, 2),
            "speed_kmh": round(params.speed_kmh, 3),
            "intensity": round(params.intensity, 4),
            "traveled_km": round(self.traveled_km, 3),
            "coast_distance_total_km": self.coast_distance_total_km,
            "distance_to_coast_km": (
                round(self.distance_to_coast_km, 3) if self.distance_to_coast_km is not None else None
            ),
            "arrival_progress": round(self.arrival_progress, 4),
            "arrived": self.arrived,
            "eta_minutes": round(self.eta_minutes, 2) if self.eta_minutes is not None else None,
            "phase": "inland" if self.minutes_since_arrival > 0 else ("landfall" if self.arrived else "offshore"),
        }


def front_state(params: PropagationParams, elapsed_minutes: float, *, stop_at_coast: bool) -> FrontState:
    """Advance the hazard front `elapsed_minutes` from the origin.

    `stop_at_coast=True` pins the position at the shoreline once reached
    (a slick beaches, a surge front piles up at the coast); False lets it
    continue inland (a cyclone eye keeps moving)."""
    hours = max(0.0, elapsed_minutes) / 60.0
    total = distance_to_coast_along_heading(params.origin_x_km, params.origin_y_km, params.heading_deg)
    traveled = params.speed_kmh * hours
    dx, dy = heading_vector(params.heading_deg)

    if total is None:
        advance = min(traveled, _MARCH_MAX_KM)
        return FrontState(
            elapsed_minutes=elapsed_minutes,
            traveled_km=round(traveled, 4),
            position_x_km=params.origin_x_km + dx * advance,
            position_y_km=params.origin_y_km + dy * advance,
            coast_distance_total_km=None,
            distance_to_coast_km=None,
            arrival_progress=0.0,
            arrived=False,
            eta_minutes=None,
            minutes_since_arrival=0.0,
        )

    arrived = traveled >= total
    progress = 1.0 if total <= 0 else clamp(traveled / total, 0.0, 1.0)
    remaining = max(0.0, total - traveled)
    eta = 0.0 if arrived else remaining / params.speed_kmh * 60.0
    since_arrival = 0.0 if not arrived else (traveled - total) / params.speed_kmh * 60.0
    advance = min(traveled, total) if stop_at_coast else traveled
    return FrontState(
        elapsed_minutes=elapsed_minutes,
        traveled_km=round(traveled, 4),
        position_x_km=params.origin_x_km + dx * advance,
        position_y_km=params.origin_y_km + dy * advance,
        coast_distance_total_km=total,
        distance_to_coast_km=remaining,
        arrival_progress=progress,
        arrived=arrived,
        eta_minutes=eta,
        minutes_since_arrival=since_arrival,
    )
