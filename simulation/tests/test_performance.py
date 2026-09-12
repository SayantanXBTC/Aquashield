"""Demo-scale performance sanity check (Prompt 7 §33) — not a benchmark
suite, just confirms the engine is fast enough for interactive use."""

import time

from simulation.core.engine import SimulationEngine

LOCATION = {"latitude": 20.0, "longitude": 88.0}

RUNS = [
    ("flood", {"duration_hours": 24, "river_level_m": 1.0, "water_rise_rate_m_per_hr": 0.2}),
    ("tsunami", {"duration_hours": 6, "initial_wave_height_m": 5.0, "magnitude": 9.0}),
    ("cyclone", {"duration_hours": 48, "wind_speed_kt": 100, "radius_km": 80}),
    ("oil_spill", {"duration_hours": 24, "spill_volume_tonnes": 1000, "wind_speed_kt": 15, "current_speed_kt": 2}),
    ("search_rescue", {"duration_hours": 12, "search_radius_km": 5}),
]


def test_demo_simulations_run_well_under_one_second_each():
    for disaster_type, config in RUNS:
        engine = SimulationEngine(
            simulation_run_id="00000000-0000-0000-0000-000000000099",
            disaster_type=disaster_type,
            scenario_config=config,
            timestep_config={"timestep_minutes": 5},  # fine-grained: worst case frame count
            location=LOCATION,
            seed=1,
        )
        start = time.perf_counter()
        frames = engine.run()
        elapsed = time.perf_counter() - start

        assert elapsed < 1.0, f"{disaster_type} took {elapsed:.3f}s for {len(frames)} frames"
