"""User-placed structures in the demo shoreline world and their exposure to
the active hazard. SIMPLIFIED DEMONSTRATION rules — not a vulnerability or
damage model (CLAUDE.md §26).

A structure is `{id, type, name, x_km, y_km, enabled}` in world km
(backend/app/schemas/scenario_config.py `StructureConfig` validates it).
Every frame each demo model calls `assess_structures` with the hazard
geometry it already computed, producing one `StructureImpact` per enabled
structure. Rules, by hazard kind (all mirrored line-for-line in
frontend/src/propagation/structures.ts and pinned by the shared fixtures):

  tsunami        after landfall: structures within the run-up reach inland
                 and within the front's lateral half-width of the landfall
                 point; exposure falls off with inland depth and lateral
                 offset, scaled by coastal impact / initial wave height.
  cyclone        within the wind-field radius of the eye; exposure falls off
                 with distance, scaled by wind / 160 kt.
  oil_spill      coastal structures (≤ 3 km from the shoreline) within the
                 slick radius (+2 km fringe) of the slick centre, scaled by
                 concentration.
  coastal_flood  after landfall: structures within the inundation reach and
                 within ±(25 km + spread) laterally of the landfall point,
                 scaled by level / peak level.

Status bands (exposure): < 0.05 clear · < 0.35 at_risk · < 0.7 impacted ·
else severe.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from simulation.core.propagation import DEFAULT_SHORE, ShoreParams, heading_vector, land_depth_km, shore_x

STRUCTURE_TYPES = ("building", "hospital", "port", "power_plant", "lighthouse", "fuel_terminal")
TSUNAMI_HALF_ANGLE_DEG = 40.0
COASTAL_STRUCTURE_MAX_SHORE_KM = 3.0
OIL_FRINGE_KM = 2.0
FLOOD_LATERAL_BASE_KM = 25.0
EXPOSURE_CLEAR = 0.05
EXPOSURE_AT_RISK = 0.35
EXPOSURE_IMPACTED = 0.7


@dataclass(frozen=True)
class StructureImpact:
    structure_id: str
    structure_type: str
    name: str
    distance_km: float
    exposure: float
    status: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "structure_id": self.structure_id,
            "structure_type": self.structure_type,
            "name": self.name,
            "distance_km": round(self.distance_km, 3),
            "exposure": round(self.exposure, 4),
            "status": self.status,
        }


def status_for(exposure: float) -> str:
    if exposure < EXPOSURE_CLEAR:
        return "clear"
    if exposure < EXPOSURE_AT_RISK:
        return "at_risk"
    if exposure < EXPOSURE_IMPACTED:
        return "impacted"
    return "severe"


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def inland_depth_km(x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> float:
    """Signed distance inland from the shoreline (negative offshore).
    One definition, in propagation.py — this name is kept because the
    exposure rules below read better with it."""
    return land_depth_km(x_km, y_km, shore)


def lateral_offset_km(px: float, py: float, ox: float, oy: float, heading_deg: float) -> float:
    """Perpendicular distance from point P to the line through O along heading."""
    dx, dy = heading_vector(heading_deg)
    return abs((px - ox) * dy - (py - oy) * dx)


@dataclass(frozen=True)
class HazardGeometry:
    """The subset of a frame's hazard state the structure rules read."""

    kind: str
    origin_x_km: float
    origin_y_km: float
    position_x_km: float
    position_y_km: float
    heading_deg: float
    arrived: bool
    coast_distance_total_km: float | None
    traveled_km: float
    spread_radius_km: float
    # kind-specific
    radius_km: float = 0.0
    inundation_km: float = 0.0
    scale: float = 0.0  # tsunami: coastal_impact/initial height; cyclone: wind/160; oil: concentration; flood: level/peak


def _landfall_point(g: HazardGeometry) -> tuple[float, float] | None:
    if g.coast_distance_total_km is None:
        return None
    dx, dy = heading_vector(g.heading_deg)
    return g.origin_x_km + dx * g.coast_distance_total_km, g.origin_y_km + dy * g.coast_distance_total_km


def exposure_for(g: HazardGeometry, x_km: float, y_km: float, shore: ShoreParams = DEFAULT_SHORE) -> tuple[float, float]:
    """Returns (distance_km to the hazard reference point, exposure 0-1)."""
    if g.kind == "tsunami":
        landfall = _landfall_point(g)
        dist = math.hypot(x_km - g.position_x_km, y_km - g.position_y_km)
        if not g.arrived or landfall is None or g.inundation_km <= 0:
            return dist, 0.0
        depth = inland_depth_km(x_km, y_km, shore)
        if depth < -0.5 or depth > g.inundation_km:
            return dist, 0.0
        half_width = max(5.0, g.traveled_km * math.tan(math.radians(TSUNAMI_HALF_ANGLE_DEG)))
        lateral = lateral_offset_km(x_km, y_km, g.origin_x_km, g.origin_y_km, g.heading_deg)
        if lateral > half_width:
            return dist, 0.0
        depth_factor = 1.0 - max(0.0, depth) / g.inundation_km
        lateral_factor = 1.0 - 0.5 * (lateral / half_width)
        return dist, _clamp01(g.scale * depth_factor * lateral_factor)

    if g.kind == "cyclone":
        dist = math.hypot(x_km - g.position_x_km, y_km - g.position_y_km)
        if g.radius_km <= 0 or dist > g.radius_km:
            return dist, 0.0
        return dist, _clamp01(g.scale * (1.0 - dist / g.radius_km) ** 0.7)

    if g.kind == "oil_spill":
        dist = math.hypot(x_km - g.position_x_km, y_km - g.position_y_km)
        if inland_depth_km(x_km, y_km, shore) > COASTAL_STRUCTURE_MAX_SHORE_KM:
            return dist, 0.0  # oil only touches the coast
        reach = g.radius_km + OIL_FRINGE_KM
        if dist > reach:
            return dist, 0.0
        return dist, _clamp01(g.scale * (1.0 - dist / reach))

    if g.kind == "coastal_flood":
        landfall = _landfall_point(g)
        dist = math.hypot(x_km - g.position_x_km, y_km - g.position_y_km)
        if not g.arrived or landfall is None or g.inundation_km <= 0:
            return dist, 0.0
        depth = inland_depth_km(x_km, y_km, shore)
        if depth < -0.5 or depth > g.inundation_km:
            return dist, 0.0
        lateral_limit = FLOOD_LATERAL_BASE_KM + g.spread_radius_km
        lateral = lateral_offset_km(x_km, y_km, g.origin_x_km, g.origin_y_km, g.heading_deg)
        if lateral > lateral_limit:
            return dist, 0.0
        depth_factor = 1.0 - max(0.0, depth) / g.inundation_km
        lateral_factor = 1.0 - 0.4 * (lateral / lateral_limit)
        return dist, _clamp01(g.scale * depth_factor * lateral_factor)

    return 0.0, 0.0


def assess_structures(structures: list[dict[str, Any]] | None, geometry: HazardGeometry, shore: ShoreParams = DEFAULT_SHORE) -> list[StructureImpact]:
    impacts: list[StructureImpact] = []
    for raw in structures or []:
        if not isinstance(raw, dict) or raw.get("enabled", True) is False:
            continue
        try:
            x = float(raw["x_km"])
            y = float(raw["y_km"])
        except (KeyError, TypeError, ValueError):
            continue
        dist, exposure = exposure_for(geometry, x, y, shore)
        impacts.append(
            StructureImpact(
                structure_id=str(raw.get("id", "")),
                structure_type=str(raw.get("type", "building")),
                name=str(raw.get("name", "")),
                distance_km=dist,
                exposure=exposure,
                status=status_for(exposure),
            )
        )
    return impacts
