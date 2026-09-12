"""Oil spill demo model (demo shoreline world — Prompt 12)."""

from simulation.core.engine import SimulationEngine


def _run(**config_overrides):
    config = {
        "duration_hours": 8,
        "origin_x_km": 170,
        "origin_y_km": 150,
        "heading_deg": 90,
        "speed_kmh": 3,
        "intensity": 0.7,
        "spread_radius_km": 18,
        "dispersion_rate": 0.4,
        **config_overrides,
    }
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000013",
        disaster_type="oil_spill",
        scenario_config=config,
        timestep_config={"timestep_minutes": 30},
        location=None,
        seed=1,
    )
    return engine.run()


def test_slick_drifts_toward_coast_and_beaches():
    frames = _run()
    xs = [f.state.hazard_state["center"]["x"] for f in frames]
    assert xs == sorted(xs) and xs[-1] > xs[0]
    assert frames[-1].state.hazard_state["beached"] is True
    # Pinned at the shoreline once beached.
    assert frames[-1].state.hazard_state["distance_to_coast_km"] == 0.0


def test_slick_area_grows_over_time():
    frames = _run()
    areas = [f.state.hazard_state["slick_area_km2"] for f in frames]
    assert areas == sorted(areas) and areas[-1] > areas[0]


def test_concentration_decays_over_time():
    frames = _run()
    concentrations = [f.state.hazard_state["concentration_index"] for f in frames]
    assert concentrations[0] > concentrations[-1]


def test_higher_dispersion_spreads_faster_and_thins_faster():
    slow = _run(dispersion_rate=0.1)
    fast = _run(dispersion_rate=0.9)
    mid = len(slow) // 2
    assert fast[mid].state.hazard_state["slick_radius_km"] > slow[mid].state.hazard_state["slick_radius_km"]
    assert fast[-1].state.hazard_state["concentration_index"] < slow[-1].state.hazard_state["concentration_index"]
