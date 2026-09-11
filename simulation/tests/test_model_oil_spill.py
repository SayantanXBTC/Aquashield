from simulation.core.engine import SimulationEngine

LOCATION = {"latitude": 19.0, "longitude": 72.8}


def _run(**config_overrides):
    config = {
        "duration_hours": 8,
        "spill_volume_tonnes": 500,
        "oil_type": "crude",
        "wind_speed_kt": 10,
        "wind_direction_deg": 45,
        "current_speed_kt": 1.5,
        "current_direction_deg": 90,
        **config_overrides,
    }
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000013",
        disaster_type="oil_spill",
        scenario_config=config,
        timestep_config={"timestep_minutes": 30},
        location=LOCATION,
        seed=1,
    )
    return engine.run()


def test_plume_position_moves_over_time():
    frames = _run()
    first_center = frames[0].state.hazard_state["center"]
    last_center = frames[-1].state.hazard_state["center"]
    assert first_center != last_center


def test_slick_area_grows_over_time():
    frames = _run()
    areas = [f.state.hazard_state["slick_area_km2"] for f in frames]
    assert areas == sorted(areas)
    assert areas[-1] > areas[0]


def test_concentration_decays_over_time():
    frames = _run()
    concentrations = [f.state.hazard_state["concentration_index"] for f in frames]
    assert concentrations[0] > concentrations[-1]


def test_larger_spill_volume_produces_larger_area():
    small = _run(spill_volume_tonnes=10)
    large = _run(spill_volume_tonnes=2000)
    assert (
        large[-1].state.hazard_state["slick_area_km2"] > small[-1].state.hazard_state["slick_area_km2"]
    )
