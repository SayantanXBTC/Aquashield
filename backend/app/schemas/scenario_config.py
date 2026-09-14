"""Disaster-specific `scenario_config` validation.

Common fields (the simulation time window) are validated centrally for every
disaster type. Disaster-specific fields are validated by a per-type model
where one exists; a disaster type with no specific model yet just accepts a
structurally valid JSON object — extend DISASTER_CONFIG_SCHEMAS to add one.

This validates DATA VALIDITY (types, ranges, structure) — not scientific
model validity. A magnitude of 9.5 or a wind speed of 300kt is not rejected
here; only malformed/out-of-domain values are (e.g. a negative volume, a
direction outside 0-360°). See docs/development/scenarios.md.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.db.models.enums import DisasterType


class _CommonWindow(BaseModel):
    """Simulation time window — common across every disaster type."""

    model_config = ConfigDict(extra="ignore")

    start_time: datetime | None = None
    duration_hours: float | None = Field(default=None, gt=0)


# Edge length of the demo shoreline world, in km — must equal
# simulation/core/propagation.py's WORLD_KM (and the frontend mirror).
DEMO_WORLD_KM = 300.0


class PropagationConfig(BaseModel):
    """Propagation parameters common to every disaster type — the values the
    Command Center's inline HUD sliders and draggable origin pin edit
    (simulation/core/propagation.py consumes them). All optional: a model
    falls back to its own documented default for any key left unset.

    Coordinates are kilometres in the synthetic demo shoreline world, never
    real-world lat/lon."""

    model_config = ConfigDict(extra="ignore")

    origin_x_km: float | None = Field(default=None, ge=0, le=DEMO_WORLD_KM)
    origin_y_km: float | None = Field(default=None, ge=0, le=DEMO_WORLD_KM)
    heading_deg: float | None = Field(default=None, ge=0, le=360)
    speed_kmh: float | None = Field(default=None, gt=0, le=2000)
    intensity: float | None = Field(default=None, ge=0, le=1)
    spread_radius_km: float | None = Field(default=None, ge=0, le=150)
    dispersion_rate: float | None = Field(default=None, ge=0, le=1)
    # A 3D-world/geometry choice. "demo"/"dense_coastal" are purely cosmetic
    # rendering variants of the fictional world; "real_map" is the deliberate
    # exception — a real MapLibre basemap anchored at anchor_lat/anchor_lon,
    # still running the same simplified hazard model over the same km frame
    # (CLAUDE.md's "real_map" world profile). None of the three is read by
    # the Python simulation engine. `None` (not a "demo" default) so
    # is_config_populated() below is unaffected for scenarios that never
    # touch this field (see docs/development/scenarios.md).
    world_profile: Literal["demo", "dense_coastal", "real_map"] | None = None
    # Only meaningful for world_profile="real_map" — where the km frame's
    # centre (150, 150) sits on the real earth. Never consumed by the
    # simulation engine, only the frontend's render-boundary projection.
    anchor_lat: float | None = Field(default=None, ge=-90, le=90)
    anchor_lon: float | None = Field(default=None, ge=-180, le=180)


class FloodConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    rainfall_mm_24h: float | None = Field(default=None, ge=0)
    river_level_m: float | None = Field(default=None, ge=0)
    water_rise_rate_m_per_hr: float | None = None
    drainage_capacity_pct: float | None = Field(default=None, ge=0, le=100)


class TsunamiConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    source_latitude: float | None = Field(default=None, ge=-90, le=90)
    source_longitude: float | None = Field(default=None, ge=-180, le=180)
    magnitude: float | None = Field(default=None, ge=0, le=10)
    initial_wave_height_m: float | None = Field(default=None, ge=0)
    propagation_direction_deg: float | None = Field(default=None, ge=0, le=360)


class CycloneConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    central_pressure_hpa: float | None = Field(default=None, ge=800, le=1050)
    wind_speed_kt: float | None = Field(default=None, ge=0)
    radius_km: float | None = Field(default=None, ge=0)
    track: list[dict[str, Any]] | None = None


class OilSpillConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    spill_volume_tonnes: float | None = Field(default=None, ge=0)
    spill_location: dict[str, float] | None = None
    oil_type: str | None = None
    wind_speed_kt: float | None = Field(default=None, ge=0)
    wind_direction_deg: float | None = Field(default=None, ge=0, le=360)
    current_speed_kt: float | None = Field(default=None, ge=0)
    current_direction_deg: float | None = Field(default=None, ge=0, le=360)


class SearchRescueConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    incident_location: dict[str, float] | None = None
    vessel_type: str | None = None
    drift_conditions: dict[str, Any] | None = None
    search_radius_km: float | None = Field(default=None, ge=0)


# Disaster types with no specific model yet accept any structurally valid
# object — add a model here to give them real field-level validation.
DISASTER_CONFIG_SCHEMAS: dict[DisasterType, type[BaseModel] | None] = {
    DisasterType.FLOOD: FloodConfig,
    DisasterType.FLASH_FLOOD: FloodConfig,
    DisasterType.COASTAL_FLOOD: FloodConfig,
    DisasterType.STORM_SURGE: CycloneConfig,
    DisasterType.CYCLONE: CycloneConfig,
    DisasterType.TSUNAMI: TsunamiConfig,
    DisasterType.OIL_SPILL: OilSpillConfig,
    DisasterType.CHEMICAL_POLLUTION: OilSpillConfig,
    DisasterType.SEARCH_RESCUE: SearchRescueConfig,
}

STRUCTURE_TYPES = ("building", "hospital", "port", "power_plant", "lighthouse", "fuel_terminal")
MAX_STRUCTURES = 50


class StructureConfig(BaseModel):
    """A user-placed structure in the demo shoreline world (km coordinates).
    simulation/core/structures.py assesses its exposure each frame."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    type: str = Field(pattern="^(" + "|".join(STRUCTURE_TYPES) + ")$")
    name: str = Field(default="", max_length=80)
    x_km: float = Field(ge=0, le=DEMO_WORLD_KM)
    y_km: float = Field(ge=0, le=DEMO_WORLD_KM)
    enabled: bool = True


class _StructuresBlock(BaseModel):
    model_config = ConfigDict(extra="ignore")

    structures: list[StructureConfig] | None = Field(default=None, max_length=MAX_STRUCTURES)


_WINDOW_KEYS = {"start_time", "duration_hours"}
_STRUCTURE_KEYS = {"structures"}
_PROPAGATION_KEYS = set(PropagationConfig.model_fields)
_COMMON_KEYS = _WINDOW_KEYS | _PROPAGATION_KEYS | _STRUCTURE_KEYS


def validate_scenario_config(disaster_type: DisasterType, raw: dict[str, Any] | None) -> dict[str, Any]:
    """Validate and normalize a scenario_config dict. Raises ValueError with a
    human-readable message on invalid input — callers turn that into a 422."""
    raw = raw or {}
    if not isinstance(raw, dict):
        raise ValueError("scenario_config must be a JSON object")

    window_raw = {k: v for k, v in raw.items() if k in _WINDOW_KEYS}
    propagation_raw = {k: v for k, v in raw.items() if k in _PROPAGATION_KEYS}
    structures_raw = {k: v for k, v in raw.items() if k in _STRUCTURE_KEYS}
    specific_raw = {k: v for k, v in raw.items() if k not in _COMMON_KEYS}

    try:
        common = _CommonWindow(**window_raw)
    except ValidationError as exc:
        raise ValueError(f"Invalid scenario_config time window: {exc.errors()}") from exc
    try:
        propagation = PropagationConfig(**propagation_raw)
    except ValidationError as exc:
        raise ValueError(f"Invalid scenario_config propagation parameters: {exc.errors()}") from exc
    try:
        structures = _StructuresBlock(**structures_raw)
    except ValidationError as exc:
        raise ValueError(f"Invalid scenario_config structures: {exc.errors()}") from exc

    schema_cls = DISASTER_CONFIG_SCHEMAS.get(disaster_type)
    if schema_cls is not None:
        try:
            specific = schema_cls(**specific_raw)
        except ValidationError as exc:
            raise ValueError(f"Invalid scenario_config for {disaster_type.value}: {exc.errors()}") from exc
        specific_dict = specific.model_dump(exclude_none=True)
    else:
        specific_dict = specific_raw

    return {
        **common.model_dump(exclude_none=True, mode="json"),
        **propagation.model_dump(exclude_none=True),
        **structures.model_dump(exclude_none=True),
        **specific_dict,
    }


def is_config_populated(disaster_type: DisasterType, config: dict[str, Any]) -> bool:
    """Whether validated config has enough content to reasonably mark a
    scenario 'ready' rather than 'draft' — any propagation parameter or any
    disaster-specific field counts; the bare time window alone does not."""
    populated_keys = set(config) - _WINDOW_KEYS
    return len(populated_keys) > 0
