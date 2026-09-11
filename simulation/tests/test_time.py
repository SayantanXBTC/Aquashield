from datetime import datetime, timedelta, timezone

import pytest

from simulation.core.errors import SimulationConfigError
from simulation.core.time import SimulationClock, build_clock


def test_total_steps_and_timestamps():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    clock = SimulationClock(start_time=start, duration_minutes=120, timestep_minutes=15)

    assert clock.total_steps == 8
    assert clock.timestamp_at(0) == start
    assert clock.timestamp_at(4) == start + timedelta(minutes=60)
    assert clock.timestamp_at(8) == start + timedelta(minutes=120)


def test_progress_at():
    clock = SimulationClock(
        start_time=datetime.now(timezone.utc), duration_minutes=100, timestep_minutes=25
    )
    assert clock.progress_at(0) == 0.0
    assert clock.progress_at(2) == 0.5
    assert clock.progress_at(4) == 1.0


def test_rejects_non_positive_timestep():
    with pytest.raises(SimulationConfigError):
        SimulationClock(start_time=datetime.now(timezone.utc), duration_minutes=60, timestep_minutes=0)


def test_rejects_non_positive_duration():
    with pytest.raises(SimulationConfigError):
        SimulationClock(start_time=datetime.now(timezone.utc), duration_minutes=0, timestep_minutes=15)


def test_rejects_non_divisible_duration():
    with pytest.raises(SimulationConfigError):
        SimulationClock(start_time=datetime.now(timezone.utc), duration_minutes=50, timestep_minutes=15)


def test_build_clock_rounds_duration_down_to_nearest_timestep():
    clock = build_clock({"duration_hours": 1.4}, {"timestep_minutes": 15})
    # 84 minutes -> rounds down to 75 (5 * 15)
    assert clock.duration_minutes == 75
    assert clock.total_steps == 5


def test_build_clock_uses_defaults_when_config_is_sparse():
    clock = build_clock({}, {})
    assert clock.timestep_minutes == 15
    assert clock.duration_minutes == 360  # DEFAULT_DURATION_HOURS=6.0 * 60


def test_build_clock_parses_iso_start_time():
    clock = build_clock({"start_time": "2026-06-01T00:00:00Z", "duration_hours": 2}, {})
    assert clock.start_time.year == 2026
    assert clock.start_time.month == 6


def test_build_clock_rejects_non_positive_timestep_minutes():
    with pytest.raises(SimulationConfigError):
        build_clock({"duration_hours": 1}, {"timestep_minutes": 0})
