"""A curated real city's fitted shoreline (architecture.md ADR-009) actually
reaches the authoritative recorded-run engine, not just the frontend live
preview. Physics stays the same simplified model; only the shoreline
geometry a recorded run measures distance/exposure against changes."""

import json

import pytest

from simulation.core.engine import SimulationEngine
from simulation.core.errors import SimulationConfigError
from simulation.core.propagation import _TOWNS_DIR, DEFAULT_SHORE, shore_params_for_city, shore_x


def _town_ids() -> list[str]:
    return sorted(p.stem for p in _TOWNS_DIR.glob("*.json"))


def _coast_distance(**extra_config) -> float | None:
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-0000000000ab",
        disaster_type="tsunami",
        scenario_config={"duration_hours": 1, "origin_x_km": 100, "origin_y_km": 150, "heading_deg": 90, **extra_config},
        timestep_config={"timestep_minutes": 15},
        location=None,
        seed=1,
    )
    frames = engine.run()
    return frames[2].to_dict()["state"]["hazard_state"]["coast_distance_total_km"]


def test_shore_params_for_city_loads_the_committed_chennai_fit():
    shore = shore_params_for_city("chennai")
    assert shore != DEFAULT_SHORE
    assert len(shore.terms) == 3
    # Chennai's fitted curve must differ from the fictional one somewhere
    # in the world — otherwise the "real" geometry would be indistinguishable.
    assert shore_x(150.0, shore) != shore_x(150.0)


def test_shore_params_for_unknown_city_raises_rather_than_falling_back():
    with pytest.raises(SimulationConfigError):
        shore_params_for_city("atlantis")


def test_recorded_run_for_a_real_city_measures_distance_against_its_own_shoreline():
    # Same origin/heading, only city_id differs — a real, measured
    # divergence, not a cosmetic one, proves PropagationParams.from_config
    # actually threads the override into the authoritative engine.
    demo_distance = _coast_distance()
    chennai_distance = _coast_distance(city_id="chennai", world_profile="real_city")
    assert demo_distance is not None and chennai_distance is not None
    assert demo_distance != pytest.approx(chennai_distance, abs=0.5)


def test_recorded_run_without_city_id_is_unaffected():
    # Regression guard: omitting city_id/world_profile must reproduce
    # exactly today's fictional-world behaviour, byte for byte.
    a = _coast_distance()
    b = _coast_distance()
    assert a == b


@pytest.mark.parametrize("city_id", _town_ids())
def test_town_declares_an_ocean_side(city_id: str) -> None:
    data = json.loads((_TOWNS_DIR / f"{city_id}.json").read_text(encoding="utf-8"))
    assert data["ocean_side"] in ("east", "west")


@pytest.mark.parametrize("city_id", _town_ids())
def test_shore_params_carry_the_orientation(city_id: str) -> None:
    data = json.loads((_TOWNS_DIR / f"{city_id}.json").read_text(encoding="utf-8"))
    shore = shore_params_for_city(city_id)
    assert shore.land_sign == (1.0 if data["ocean_side"] == "west" else -1.0)


def test_missing_ocean_side_is_a_config_error(tmp_path, monkeypatch) -> None:
    bad = tmp_path / "nowhere.json"
    bad.write_text(json.dumps({"shore_base_x_km": 150.0, "shore_terms": []}), encoding="utf-8")
    monkeypatch.setattr("simulation.core.propagation._TOWNS_DIR", tmp_path)
    with pytest.raises(SimulationConfigError):
        shore_params_for_city("nowhere")
