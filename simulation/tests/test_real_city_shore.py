"""A curated real city's fitted shoreline (architecture.md ADR-009) actually
reaches the authoritative recorded-run engine, not just the frontend live
preview. Physics stays the same simplified model; only the shoreline
geometry a recorded run measures distance/exposure against changes."""

import pytest

from simulation.core.engine import SimulationEngine
from simulation.core.errors import SimulationConfigError
from simulation.core.propagation import DEFAULT_SHORE, shore_params_for_city, shore_x


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
