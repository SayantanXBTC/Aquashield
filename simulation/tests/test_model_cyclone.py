from simulation.core.engine import SimulationEngine

LOCATION = {"latitude": 15.0, "longitude": 90.0}


def _run(**config_overrides):
    config = {"duration_hours": 6, "wind_speed_kt": 120, "radius_km": 60, **config_overrides}
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000012",
        disaster_type="cyclone",
        scenario_config=config,
        timestep_config={"timestep_minutes": 30},
        location=LOCATION,
        seed=1,
    )
    return engine.run()


def test_center_position_changes_over_time_without_track():
    frames = _run()
    first_center = frames[0].state.hazard_state["center"]
    last_center = frames[-1].state.hazard_state["center"]
    assert first_center != last_center


def test_hazard_radius_grows_over_time():
    frames = _run()
    radii = [f.state.hazard_state["hazard_radius_km"] for f in frames]
    assert radii == sorted(radii)
    assert radii[-1] > radii[0]


def test_wind_speed_decays_over_time():
    frames = _run()
    winds = [f.state.hazard_state["wind_speed_kt"] for f in frames]
    assert winds[0] > winds[-1]


def test_explicit_track_is_followed():
    track = [
        {"latitude": 10.0, "longitude": 85.0},
        {"latitude": 12.0, "longitude": 87.0},
        {"latitude": 14.0, "longitude": 89.0},
    ]
    frames = _run(track=track)
    first_center = frames[0].state.hazard_state["center"]
    last_center = frames[-1].state.hazard_state["center"]
    assert first_center["latitude"] == 10.0
    assert last_center["latitude"] == 14.0
