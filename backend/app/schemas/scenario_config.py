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
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.db.models.enums import DisasterType


class _CommonWindow(BaseModel):
    """Simulation time window — common across every disaster type."""

    model_config = ConfigDict(extra="ignore")

    start_time: datetime | None = None
    duration_hours: float | None = Field(default=None, gt=0)


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

_COMMON_KEYS = {"start_time", "duration_hours"}


def validate_scenario_config(disaster_type: DisasterType, raw: dict[str, Any] | None) -> dict[str, Any]:
    """Validate and normalize a scenario_config dict. Raises ValueError with a
    human-readable message on invalid input — callers turn that into a 422."""
    raw = raw or {}
    if not isinstance(raw, dict):
        raise ValueError("scenario_config must be a JSON object")

    common_raw = {k: v for k, v in raw.items() if k in _COMMON_KEYS}
    specific_raw = {k: v for k, v in raw.items() if k not in _COMMON_KEYS}

    try:
        common = _CommonWindow(**common_raw)
    except ValidationError as exc:
        raise ValueError(f"Invalid scenario_config time window: {exc.errors()}") from exc

    schema_cls = DISASTER_CONFIG_SCHEMAS.get(disaster_type)
    if schema_cls is not None:
        try:
            specific = schema_cls(**specific_raw)
        except ValidationError as exc:
            raise ValueError(f"Invalid scenario_config for {disaster_type.value}: {exc.errors()}") from exc
        specific_dict = specific.model_dump(exclude_none=True)
    else:
        specific_dict = specific_raw

    return {**common.model_dump(exclude_none=True, mode="json"), **specific_dict}


def is_config_populated(disaster_type: DisasterType, config: dict[str, Any]) -> bool:
    """Whether validated config has enough disaster-specific content to
    reasonably mark a scenario 'ready' rather than 'draft'."""
    specific_keys = set(config) - _COMMON_KEYS
    return len(specific_keys) > 0
