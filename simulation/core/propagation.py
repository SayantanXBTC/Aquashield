"""Demo shoreline world + propagation kinematics shared by every disaster
model. SIMPLIFIED DEMONSTRATION geometry — not a coastline, not bathymetry,
not a transport model (CLAUDE.md §26).

THE WORLD. A 300 km x 300 km square, coordinates in kilometres with +x east
and +y north. By default ocean lies west of the shoreline and land east of
it; `land_sign` (+1 = land east, -1 = land west) selects which. The
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

import base64
import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from simulation.core.errors import SimulationConfigError

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

# Repo root, so a "real_city" scenario's shoreline can be read from the same
# committed shared/constants/towns/<city_id>.json the frontend bundles — one
# source of truth, not a second hand-synced constant set (architecture.md
# ADR-009). simulation/ stays framework-free: this is a plain file read, no
# import of backend/app or frontend code.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_TOWNS_DIR = _REPO_ROOT / "shared" / "constants" / "towns"


@dataclass(frozen=True)
class LandField:
    """A rasterised signed-distance-to-coast field for a curated real city
    (the `land_field` block in `shared/constants/towns/<city>.json`) — where
    it covers, it is authoritative over the sine curve. `data` is the raw
    decoded bytes (resolution*resolution int16 little-endian, row-major from
    the SW corner, x fastest); kept as `bytes` rather than unpacked into a
    list so the dataclass stays hashable and the one-time base64 decode in
    `shore_params_for_city` is the only decode that ever happens — sampling
    reads two bytes directly out of the buffer."""

    origin_x_km: float
    origin_y_km: float
    size_km: float
    resolution: int
    scale_km: float
    data: bytes

    def sample(self, x_km: float, y_km: float) -> float | None:
        """Signed land depth in km at (x, y), or None outside the field's
        coverage (caller falls back to the sine curve). Nearest-neighbour,
        identical to the TS/GLSL twins — see CLAUDE.md's contract."""
        u = (x_km - self.origin_x_km) / self.size_km
        v = (y_km - self.origin_y_km) / self.size_km
        if u < 0.0 or u >= 1.0 or v < 0.0 or v >= 1.0:
            return None
        col = min(max(int(math.floor(u * self.resolution)), 0), self.resolution - 1)
        row = min(max(int(math.floor(v * self.resolution)), 0), self.resolution - 1)
        index = row * self.resolution + col
        raw = struct.unpack_from("<h", self.data, index * 2)[0]
        return raw * self.scale_km


@dataclass(frozen=True)
class ShoreParams:
    """The shoreline's shape and which side of it is land — the fictional
    demo constants by default, or a curated real city's fitted curve
    (ADR-009). Never real lat/lon; always the same 3-term-sine shape
    `shore_x` expects, whatever produced it.

    `land_sign` is the coast's orientation: +1 means land lies east of the
    curve and the ocean west of it (a west-facing coast, e.g. the Arabian
    Sea); -1 is the reverse (an east-facing coast, e.g. the Bay of Bengal).
    It is the ONLY thing that distinguishes the two — every land test in the
    engine is `land_sign * (x - shore_x(y))`.

    `land_field`, when present, is a rasterised true coastline that takes
    priority over the sine curve wherever it covers (a peninsula/lagoon the
    curve structurally cannot express) — see `land_depth_km`."""

    base_x_km: float = SHORE_BASE_X_KM
    terms: tuple[tuple[float, float, float], ...] = SHORE_TERMS
    land_sign: float = 1.0
    land_field: LandField | None = None


DEFAULT_SHORE = ShoreParams()


def shore_params_for_city(city_id: str) -> ShoreParams:
    """Loads a curated real city's fitted shoreline (ADR-009) from the
    committed town JSON. Raises rather than silently falling back to the
    fictional shoreline — a missing/malformed city dataset is a config
    error, not something to paper over with the wrong geometry."""
    path = _TOWNS_DIR / f"{city_id}.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SimulationConfigError(f"No town data for city_id={city_id!r} at {path}. Run scripts/build_town_data.py.") from exc
    except json.JSONDecodeError as exc:
        raise SimulationConfigError(f"Town data at {path} is not valid JSON: {exc}") from exc
    try:
        base_x_km = data["shore_base_x_km"]
        terms = tuple((t["amp"], t["freq"], t["phase"]) for t in data["shore_terms"])
        ocean_side = data["ocean_side"]
    except (KeyError, TypeError) as exc:
        raise SimulationConfigError(
            f"Town data at {path} is missing shore_base_x_km/shore_terms/ocean_side: {exc}"
        ) from exc
    if ocean_side not in ("east", "west"):
        raise SimulationConfigError(f"Town data at {path} has ocean_side={ocean_side!r}; expected 'east' or 'west'.")
    land_field = _decode_land_field(data.get("land_field"), path)
    # Ocean west means land lies east of the curve, and vice versa.
    return ShoreParams(
        base_x_km=base_x_km,
        terms=terms,
        land_sign=1.0 if ocean_side == "west" else -1.0,
        land_field=land_field,
    )


def _decode_land_field(raw: dict[str, Any] | None, path: Path) -> LandField | None:
    """Decodes the optional `land_field` block once at load time. Absent in
    a town without one (or an older town JSON) — every caller falls back to
    the sine curve in that case, so returning None here is the entire
    backward-compatibility story."""
    if raw is None:
        return None
    try:
        resolution = int(raw["resolution"])
        data = base64.b64decode(raw["data"])
        field = LandField(
            origin_x_km=float(raw["origin_x_km"]),
            origin_y_km=float(raw["origin_y_km"]),
            size_km=float(raw["size_km"]),
            resolution=resolution,
            scale_km=float(raw["scale_km"]),
            data=data,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise SimulationConfigError(f"Town data at {path} has a malformed land_field: {exc}") from exc
    expected_bytes = resolution * resolution * 2
    if len(data) != expected_bytes:
        raise SimulationConfigError(
            f"Town data at {path} land_field.data decodes to {len(data)} bytes, expected {expected_bytes} "
            f"for resolution={resolution}."
        )
    return field


def shore_x(y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> float:
    """East-west position of the shoreline at northing `y_km`."""
    x = shore.base_x_km
    for amp, freq, phase in shore.terms:
        x += amp * math.sin(2.0 * math.pi * freq * y_km / WORLD_KM + phase)
    return x


def land_depth_km(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> float:
    """Signed distance inland from the shoreline in km; negative offshore.
    Carries the coast's orientation, so this is the single place the
    east/west facing distinction lives.

    A curated real city's `land_field` (ADR-009) is authoritative wherever
    it covers the point; outside its coverage (or when there is no field at
    all) the analytic sine curve is the far-field fallback."""
    if shore.land_field is not None:
        sampled = shore.land_field.sample(x_km, y_km)
        if sampled is not None:
            return sampled
    return shore.land_sign * (x_km - shore_x(y_km, shore))


def is_land(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> bool:
    return land_depth_km(x_km, y_km, shore) >= 0.0


def heading_vector(heading_deg: float) -> tuple[float, float]:
    """Compass heading -> unit (dx, dy): 0° = +y (north), 90° = +x (east)."""
    rad = math.radians(heading_deg)
    return math.sin(rad), math.cos(rad)


def distance_to_coast_along_heading(x_km: float, y_km: float, heading_deg: float, shore: ShoreParams = DEFAULT_SHORE) -> float | None:
    """Distance from (x, y) to the first land point along `heading_deg`, or
    None if that line never reaches land within the world. 0.0 if the start
    point is already on land."""
    if is_land(x_km, y_km, shore):
        return 0.0
    dx, dy = heading_vector(heading_deg)
    traveled = 0.0
    while traveled < _MARCH_MAX_KM:
        nxt = traveled + _MARCH_STEP_KM
        px, py = x_km + dx * nxt, y_km + dy * nxt
        if is_land(px, py, shore):
            # Bisect the last step so the result is accurate to ~1 m.
            lo, hi = traveled, nxt
            for _ in range(12):
                mid = 0.5 * (lo + hi)
                if is_land(x_km + dx * mid, y_km + dy * mid, shore):
                    hi = mid
                else:
                    lo = mid
            return round(hi, 4)
        traveled = nxt
    return None


def nearest_shore_distance(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> float:
    """Straight-line distance to the closest shoreline sample within ±80 km
    of northing; 0 on land. Telemetry only."""
    if is_land(x_km, y_km, shore):
        return 0.0
    best = float("inf")
    y0 = y_km - 80.0
    for i in range(161):
        yi = y0 + i
        d = math.hypot(shore_x(yi, shore) - x_km, yi - y_km)
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
    # The fictional demo shoreline by default; a curated real city's fitted
    # curve when scenario_config carries world_profile="real_city" (ADR-009).
    # Every downstream shore_x/is_land/distance_to_coast_along_heading call
    # reads this, so a recorded run's physics stays geometrically consistent
    # with whatever the scene actually rendered.
    shore: ShoreParams = DEFAULT_SHORE

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

        city_id = config.get("city_id")
        shore = shore_params_for_city(city_id) if city_id else DEFAULT_SHORE

        return cls(
            origin_x_km=clamp(num("origin_x_km", DEFAULT_ORIGIN_X_KM), 0.0, WORLD_KM),
            origin_y_km=clamp(num("origin_y_km", DEFAULT_ORIGIN_Y_KM), 0.0, WORLD_KM),
            heading_deg=num("heading_deg", DEFAULT_HEADING_DEG) % 360.0,
            speed_kmh=max(0.1, num("speed_kmh", default_speed_kmh)),
            intensity=clamp(num("intensity", DEFAULT_INTENSITY), 0.0, 1.0),
            spread_radius_km=max(0.0, num("spread_radius_km", default_spread_radius_km)),
            dispersion_rate=clamp(num("dispersion_rate", DEFAULT_DISPERSION), 0.0, 1.0),
            shore=shore,
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
    total = distance_to_coast_along_heading(params.origin_x_km, params.origin_y_km, params.heading_deg, params.shore)
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
