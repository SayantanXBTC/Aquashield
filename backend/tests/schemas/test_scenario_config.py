"""Pure unit tests for backend/app/schemas/scenario_config.py — no database
required. Parametrized over all 9 DisasterType values (valid + invalid
input) rather than only the flood/tsunami cases the API-level tests happen
to exercise."""

import pytest

from app.db.models.enums import DisasterType
from app.schemas.scenario_config import is_config_populated, validate_scenario_config

VALID_CONFIG_BY_TYPE = {
    DisasterType.FLOOD: {"rainfall_mm_24h": 150, "river_level_m": 5.0},
    DisasterType.FLASH_FLOOD: {"rainfall_mm_24h": 220, "water_rise_rate_m_per_hr": 0.6},
    DisasterType.COASTAL_FLOOD: {"river_level_m": 4.0, "drainage_capacity_pct": 25},
    DisasterType.STORM_SURGE: {"central_pressure_hpa": 955, "wind_speed_kt": 85},
    DisasterType.CYCLONE: {"central_pressure_hpa": 930, "wind_speed_kt": 110, "radius_km": 150},
    DisasterType.TSUNAMI: {"magnitude": 7.8, "initial_wave_height_m": 3.5},
    DisasterType.OIL_SPILL: {"spill_volume_tonnes": 500, "oil_type": "crude"},
    DisasterType.CHEMICAL_POLLUTION: {"spill_volume_tonnes": 300, "wind_speed_kt": 8},
    DisasterType.SEARCH_RESCUE: {"search_radius_km": 6, "vessel_type": "fishing_trawler"},
}

# One deliberately out-of-domain value per type — a data-validity violation
# (never a "scientific validity" one, per CLAUDE.md §7).
INVALID_CONFIG_BY_TYPE = {
    DisasterType.FLOOD: {"rainfall_mm_24h": -10},
    DisasterType.FLASH_FLOOD: {"drainage_capacity_pct": 150},
    DisasterType.COASTAL_FLOOD: {"river_level_m": -1},
    DisasterType.STORM_SURGE: {"central_pressure_hpa": 200},
    DisasterType.CYCLONE: {"radius_km": -50},
    DisasterType.TSUNAMI: {"magnitude": 25},
    DisasterType.OIL_SPILL: {"spill_volume_tonnes": -500},
    DisasterType.CHEMICAL_POLLUTION: {"wind_direction_deg": 999},
    DisasterType.SEARCH_RESCUE: {"search_radius_km": -1},
}


@pytest.mark.parametrize("disaster_type", list(DisasterType))
def test_valid_config_accepted_for_every_disaster_type(disaster_type: DisasterType) -> None:
    result = validate_scenario_config(disaster_type, VALID_CONFIG_BY_TYPE[disaster_type])
    for key, value in VALID_CONFIG_BY_TYPE[disaster_type].items():
        assert result[key] == value


@pytest.mark.parametrize("disaster_type", list(DisasterType))
def test_invalid_config_rejected_for_every_disaster_type(disaster_type: DisasterType) -> None:
    with pytest.raises(ValueError):
        validate_scenario_config(disaster_type, INVALID_CONFIG_BY_TYPE[disaster_type])


@pytest.mark.parametrize("disaster_type", list(DisasterType))
def test_common_time_window_validated_for_every_disaster_type(disaster_type: DisasterType) -> None:
    result = validate_scenario_config(disaster_type, {"duration_hours": 12})
    assert result["duration_hours"] == 12

    with pytest.raises(ValueError):
        validate_scenario_config(disaster_type, {"duration_hours": -5})


def test_none_config_is_treated_as_empty_object() -> None:
    result = validate_scenario_config(DisasterType.FLOOD, None)
    assert result == {}


# --- world_profile: a purely cosmetic 3D-rendering choice, never a real
# place (CLAUDE.md §25/§27) ---------------------------------------------


def test_world_profile_dense_coastal_round_trips() -> None:
    result = validate_scenario_config(DisasterType.TSUNAMI, {"world_profile": "dense_coastal"})
    assert result["world_profile"] == "dense_coastal"


def test_world_profile_rejects_an_unknown_value() -> None:
    # Never a real place name — only the two known internal profile ids.
    with pytest.raises(ValueError):
        validate_scenario_config(DisasterType.TSUNAMI, {"world_profile": "real_city"})


def test_omitting_world_profile_leaves_is_config_populated_unaffected() -> None:
    # Regression guard: world_profile must default to None, not "demo" — a
    # non-None default would make model_dump(exclude_none=True) emit the key
    # on every validated config, silently flipping is_config_populated() for
    # every scenario that never touches this field.
    without = validate_scenario_config(DisasterType.TSUNAMI, {"magnitude": 7.8, "initial_wave_height_m": 3.5})
    assert "world_profile" not in without
    assert is_config_populated(DisasterType.TSUNAMI, without) is True

    empty = validate_scenario_config(DisasterType.TSUNAMI, {})
    assert "world_profile" not in empty
    assert is_config_populated(DisasterType.TSUNAMI, empty) is False
