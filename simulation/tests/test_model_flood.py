"""Coastal flood demo model (demo shoreline world — Prompt 12)."""

from simulation.core.engine import SimulationEngine


def _run(**config_overrides):
    config = {
        "duration_hours": 4,
        "origin_x_km": 150,
        "origin_y_km": 150,
        "heading_deg": 90,
        "speed_kmh": 80,
        "intensity": 0.6,
        "spread_radius_km": 10,
        "dispersion_rate": 0.3,
        **config_overrides,
    }
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000010",
        disaster_type="flood",
        scenario_config=config,
        timestep_config={"timestep_minutes": 15},
        location=None,
        seed=1,
    )
    return engine.run()


def test_surge_front_approaches_then_arrives():
    frames = _run()
    remaining = [f.state.hazard_state["distance_to_coast_km"] for f in frames]
    assert remaining[0] > 0
    assert remaining == sorted(remaining, reverse=True)
    assert frames[-1].state.hazard_state["arrived"] is True
    assert frames[-1].state.hazard_state["phase"] == "inland"


def test_water_level_rises_after_arrival_then_recedes():
    frames = _run(dispersion_rate=1.0)
    levels = [f.state.hazard_state["water_level_m"] for f in frames]
    arrival = next(i for i, f in enumerate(frames) if f.state.hazard_state["arrived"])
    assert all(level == 0.0 for level in levels[:arrival])
    peak = max(levels)
    assert peak > 0
    assert levels[-1] < peak  # receded past the 60-minute peak


def test_inundation_scales_with_spread_radius_and_intensity():
    narrow = _run(spread_radius_km=5)
    wide = _run(spread_radius_km=30)
    assert wide[-1].state.hazard_state["inundation_km"] > narrow[-1].state.hazard_state["inundation_km"]
    calm = _run(intensity=0.1)
    fierce = _run(intensity=1.0)
    assert fierce[-1].state.hazard_state["peak_level_m"] > calm[-1].state.hazard_state["peak_level_m"]


def test_landfall_is_a_key_event():
    frames = _run()
    keyed = [f.timestep for f in frames if f.is_key_event]
    arrival = next(f.timestep for f in frames if f.state.hazard_state["arrived"])
    assert arrival in keyed


def test_model_declares_itself_as_demonstration():
    from simulation.models.flood.model import FloodModel

    card = FloodModel.describe()
    assert card["type"] == "SIMPLIFIED DEMONSTRATION MODEL"
    assert card["model_identifier"] == "coastal-flood-demo-v2"
    assert "Not validated" in card["scientific_validation"]
