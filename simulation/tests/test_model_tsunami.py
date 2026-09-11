from simulation.core.engine import SimulationEngine

LOCATION = {"latitude": 13.0, "longitude": 80.3}  # coast reference


def _run(**config_overrides):
    config = {
        "start_time": "2026-01-01T00:00:00Z",
        "duration_hours": 3,
        "source_latitude": 3.3,
        "source_longitude": 95.9,  # ~2000km from LOCATION
        "magnitude": 9.1,
        "initial_wave_height_m": 5.0,
        **config_overrides,
    }
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000011",
        disaster_type="tsunami",
        scenario_config=config,
        timestep_config={"timestep_minutes": 20},
        location=LOCATION,
        seed=1,
    )
    return engine.run()


def test_wave_position_changes_over_time():
    frames = _run()
    distances = [f.state.hazard_state["distance_traveled_km"] for f in frames]
    assert distances == sorted(distances)
    assert distances[-1] > distances[0]


def test_wave_height_decays_as_it_travels():
    frames = _run()
    heights = [f.state.hazard_state["wave_height_m"] for f in frames]
    assert heights[0] >= heights[-1]


def test_arrival_progress_increases_toward_one():
    frames = _run()
    progress = [f.state.hazard_state["arrival_progress"] for f in frames]
    assert progress == sorted(progress)
    assert progress[0] == 0.0


def test_deterministic_result():
    a = [f.to_dict() for f in _run()]
    b = [f.to_dict() for f in _run()]
    assert a == b
