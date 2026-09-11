"""Same disaster_type + scenario_config + timestep_config + seed must produce
identical output (Prompt 7 §9) — critical for replay/comparison, debugging,
and auditability."""

from simulation.core.engine import SimulationEngine

# Every scenario_config pins an explicit start_time: determinism means "same
# config produces the same output," and an *unspecified* start_time falls
# back to wall-clock "now" (simulation/core/time.py) — deliberately not
# reproducible, since nothing was actually pinned. That's a property of the
# input, not a bug in the engine.
SCENARIOS: list[dict] = [
    dict(
        disaster_type="flood",
        scenario_config={
            "start_time": "2026-01-01T00:00:00Z",
            "duration_hours": 3,
            "river_level_m": 2.0,
            "water_rise_rate_m_per_hr": 0.3,
        },
        timestep_config={"timestep_minutes": 30},
    ),
    dict(
        disaster_type="tsunami",
        scenario_config={
            "start_time": "2026-01-01T00:00:00Z",
            "duration_hours": 2,
            "source_latitude": 5.0,
            "source_longitude": 95.0,
            "magnitude": 8.5,
            "initial_wave_height_m": 4.0,
        },
        timestep_config={"timestep_minutes": 15},
    ),
    dict(
        disaster_type="cyclone",
        scenario_config={
            "start_time": "2026-01-01T00:00:00Z",
            "duration_hours": 4,
            "wind_speed_kt": 90,
            "radius_km": 60,
        },
        timestep_config={"timestep_minutes": 30},
    ),
    dict(
        disaster_type="oil_spill",
        scenario_config={
            "start_time": "2026-01-01T00:00:00Z",
            "duration_hours": 5,
            "spill_volume_tonnes": 500,
            "wind_speed_kt": 12,
            "wind_direction_deg": 45,
            "current_speed_kt": 1.5,
            "current_direction_deg": 90,
        },
        timestep_config={"timestep_minutes": 30},
    ),
    dict(
        disaster_type="search_rescue",
        scenario_config={
            "start_time": "2026-01-01T00:00:00Z",
            "duration_hours": 3,
            "search_radius_km": 5,
        },
        timestep_config={"timestep_minutes": 15},
    ),
]

LOCATION = {"latitude": 13.0, "longitude": 80.3}


def _run(spec, seed=7):
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-000000000042",
        disaster_type=spec["disaster_type"],
        scenario_config=spec["scenario_config"],
        timestep_config=spec["timestep_config"],
        location=LOCATION,
        seed=seed,
    )
    return [f.to_dict() for f in engine.run()]


def test_same_config_and_seed_produce_identical_output():
    for spec in SCENARIOS:
        first = _run(spec, seed=7)
        second = _run(spec, seed=7)
        assert first == second, f"{spec['disaster_type']} run was not deterministic"


def test_different_config_produces_different_output():
    for spec in SCENARIOS:
        baseline = _run(spec, seed=7)
        changed_config = {**spec, "scenario_config": {**spec["scenario_config"], "duration_hours": 1}}
        changed = _run(changed_config, seed=7)
        assert baseline != changed, f"{spec['disaster_type']} run did not vary with config"
