from simulation.core.engine import SimulationEngine

LOCATION = {"latitude": 8.5, "longitude": 76.9}


def _run(**config_overrides):
    config = {
        "duration_hours": 6,
        "search_radius_km": 5,
        "vessel_type": "fishing_vessel",
        "drift_conditions": {"current_speed_kt": 1.0, "current_direction_deg": 200, "wind_speed_kt": 8},
        **config_overrides,
    }
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000014",
        disaster_type="search_rescue",
        scenario_config=config,
        timestep_config={"timestep_minutes": 30},
        location=LOCATION,
        seed=1,
    )
    return engine.run()


def test_drift_region_moves_over_time():
    frames = _run()
    first_center = frames[0].state.hazard_state["probable_center"]
    last_center = frames[-1].state.hazard_state["probable_center"]
    assert first_center != last_center


def test_search_area_grows_over_time():
    frames = _run()
    radii = [f.state.hazard_state["search_radius_km"] for f in frames]
    assert radii == sorted(radii)
    assert radii[-1] > radii[0]


def test_confidence_decreases_over_time():
    frames = _run()
    confidences = [f.state.hazard_state["confidence"] for f in frames]
    assert confidences[0] >= confidences[-1]
