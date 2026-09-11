import pytest

from simulation.core.engine import SimulationEngine
from simulation.core.errors import SimulationConfigError, SimulationExecutionError

FLOOD_CONFIG = {
    "start_time": "2026-01-01T00:00:00Z",
    "duration_hours": 2,
    "river_level_m": 1.0,
    "water_rise_rate_m_per_hr": 0.5,
    "drainage_capacity_pct": 0,
}
LOCATION = {"latitude": 10.0, "longitude": 20.0}


def _engine(**overrides):
    kwargs = dict(
        simulation_run_id="00000000-0000-0000-0000-000000000001",
        disaster_type="flood",
        scenario_config=FLOOD_CONFIG,
        timestep_config={"timestep_minutes": 30},
        location=LOCATION,
        seed=1,
    )
    kwargs.update(overrides)
    return SimulationEngine(**kwargs)


def test_initialize_produces_frame_zero():
    engine = _engine()
    engine.initialize()
    assert len(engine.frames) == 1
    assert engine.frames[0].timestep == 0
    assert engine.frames[0].is_key_event is True


def test_step_progresses_timestep_and_appends_frame():
    engine = _engine()
    engine.initialize()
    frame = engine.step()
    assert frame.timestep == 1
    assert len(engine.frames) == 2


def test_is_complete_reflects_clock_total_steps():
    engine = _engine()
    engine.initialize()
    assert engine.clock.total_steps == 4  # 120 min / 30 min
    for _ in range(4):
        assert engine.is_complete() is False
        engine.step()
    assert engine.is_complete() is True


def test_run_produces_total_steps_plus_one_frames():
    engine = _engine()
    frames = engine.run()
    assert len(frames) == engine.clock.total_steps + 1
    assert frames[0].timestep == 0
    assert frames[-1].timestep == engine.clock.total_steps
    assert frames[-1].is_key_event is True


def test_unknown_disaster_type_raises_config_error():
    with pytest.raises(SimulationConfigError):
        _engine(disaster_type="volcanic_eruption")


def test_invalid_timestep_config_raises_config_error():
    with pytest.raises(SimulationConfigError):
        _engine(timestep_config={"timestep_minutes": 0})


def test_step_before_initialize_raises_execution_error():
    engine = _engine()
    with pytest.raises(SimulationExecutionError):
        engine.step()


def test_step_after_completion_raises_execution_error():
    engine = _engine()
    engine.run()
    with pytest.raises(SimulationExecutionError):
        engine.step()


def test_default_seed_is_deterministic_when_unspecified():
    a = _engine(seed=None)
    b = _engine(seed=None)
    assert a.seed == b.seed == 0
