from simulation.core.engine import SimulationEngine

LOCATION = {"latitude": 22.5, "longitude": 88.3}


def _run(**config_overrides):
    config = {
        "duration_hours": 4,
        "river_level_m": 1.0,
        "water_rise_rate_m_per_hr": 0.5,
        "drainage_capacity_pct": 0,
        **config_overrides,
    }
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000010",
        disaster_type="flood",
        scenario_config=config,
        timestep_config={"timestep_minutes": 60},
        location=LOCATION,
        seed=1,
    )
    return engine.run()


def test_water_level_rises_over_time():
    frames = _run()
    levels = [f.state.hazard_state["water_level_m"] for f in frames]
    assert levels == sorted(levels)
    assert levels[-1] > levels[0]


def test_affected_area_grows_as_level_rises():
    frames = _run()
    assert frames[0].state.affected_area is None  # no rise yet at t0
    assert frames[-1].state.affected_area is not None
    assert frames[-1].state.affected_area["type"] == "Polygon"


def test_drainage_reduces_rise_rate():
    no_drainage = _run(drainage_capacity_pct=0)
    with_drainage = _run(drainage_capacity_pct=80)
    assert (
        with_drainage[-1].state.hazard_state["water_level_m"]
        < no_drainage[-1].state.hazard_state["water_level_m"]
    )


def test_model_declares_itself_as_demonstration():
    from simulation.models.flood.model import FloodModel

    card = FloodModel.describe()
    assert card["type"] == "SIMPLIFIED DEMONSTRATION MODEL"
    assert card["model_identifier"] == "flood-demo-v1"
    assert "Not validated" in card["scientific_validation"]
