"""Cyclone demo model (demo shoreline world — Prompt 12)."""

from simulation.core.engine import SimulationEngine


def _run(**config_overrides):
    config = {
        "duration_hours": 8,
        "origin_x_km": 80,
        "origin_y_km": 120,
        "heading_deg": 70,
        "speed_kmh": 30,
        "intensity": 0.8,
        "spread_radius_km": 70,
        "dispersion_rate": 0.5,
        **config_overrides,
    }
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000012",
        disaster_type="cyclone",
        scenario_config=config,
        timestep_config={"timestep_minutes": 30},
        location=None,
        seed=1,
    )
    return engine.run()


def test_center_moves_along_heading_and_continues_inland():
    frames = _run()
    first = frames[0].state.hazard_state["center"]
    last = frames[-1].state.hazard_state["center"]
    assert last["x"] > first["x"] and last["y"] > first["y"]  # heading 70°: east-north-east
    assert frames[-1].state.hazard_state["arrived"] is True
    traveled = frames[-1].state.hazard_state["traveled_km"]
    total = frames[-1].state.hazard_state["coast_distance_total_km"]
    assert traveled > total  # kept moving past the coast


def test_wind_holds_offshore_and_decays_inland():
    frames = _run()
    winds = [f.state.hazard_state["wind_speed_kt"] for f in frames]
    offshore = [w for w, f in zip(winds, frames) if not f.state.hazard_state["arrived"]]
    assert len(set(offshore)) == 1  # constant until landfall
    assert winds[-1] < winds[0]


def test_wind_field_radius_is_the_configured_spread():
    frames = _run(spread_radius_km=55)
    assert all(f.state.hazard_state["hazard_radius_km"] == 55.0 for f in frames)


def test_intensity_sets_peak_wind():
    weak = _run(intensity=0.1)
    strong = _run(intensity=1.0)
    assert strong[0].state.hazard_state["wind_speed_kt"] > weak[0].state.hazard_state["wind_speed_kt"]
