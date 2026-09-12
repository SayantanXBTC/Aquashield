"""Tsunami demo model (demo shoreline world — Prompt 12)."""

from simulation.core.engine import SimulationEngine


def _run(**config_overrides):
    config = {
        "start_time": "2026-01-01T00:00:00Z",
        "duration_hours": 2,
        "origin_x_km": 45,
        "origin_y_km": 140,
        "heading_deg": 90,
        "speed_kmh": 500,
        "intensity": 0.6,
        "spread_radius_km": 12,
        **config_overrides,
    }
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000011",
        disaster_type="tsunami",
        scenario_config=config,
        timestep_config={"timestep_minutes": 5},
        location=None,
        seed=1,
    )
    return engine.run()


def test_front_radius_grows_over_time():
    frames = _run()
    radii = [f.state.hazard_state["front_radius_km"] for f in frames]
    assert radii == sorted(radii) and radii[-1] > radii[0]


def test_wave_height_decays_as_it_travels():
    frames = _run()
    heights = [f.state.hazard_state["wave_height_m"] for f in frames]
    assert heights[0] > heights[-1]


def test_arrival_progress_increases_toward_one_and_flags_key_event():
    frames = _run()
    progress = [f.state.hazard_state["arrival_progress"] for f in frames]
    assert progress == sorted(progress)
    assert progress[-1] == 1.0
    arrival = next(f.timestep for f in frames if f.state.hazard_state["arrived"])
    assert frames[arrival].is_key_event is True


def test_run_up_grows_after_landfall():
    frames = _run()
    inundation = [f.state.hazard_state["inundation_km"] for f in frames]
    assert inundation[0] == 0.0
    assert inundation[-1] > 0.0
    assert inundation[-1] <= 12 * 0.6 + 1e-9


def test_heading_away_from_coast_never_arrives():
    frames = _run(heading_deg=270)
    assert frames[-1].state.hazard_state["distance_to_coast_km"] is None
    assert frames[-1].state.hazard_state["arrived"] is False


def test_deterministic_result():
    a = _run()
    b = _run()
    assert [f.state.hazard_state for f in a] == [f.state.hazard_state for f in b]
