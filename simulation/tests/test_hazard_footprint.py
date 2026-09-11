import pytest

from simulation.core.engine import SimulationEngine
from simulation.core.hazard_footprint import (
    HazardFootprintError,
    build_hazard_footprint,
)

LOCATION = {"latitude": 22.5, "longitude": 88.3}


def _run_flood():
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-0000000000f1",
        disaster_type="flood",
        scenario_config={
            "duration_hours": 4,
            "river_level_m": 1.0,
            "water_rise_rate_m_per_hr": 0.5,
            "drainage_capacity_pct": 0,
        },
        timestep_config={"timestep_minutes": 60},
        location=LOCATION,
        seed=1,
    )
    return engine, engine.run()


def _run_cyclone():
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-0000000000f2",
        disaster_type="cyclone",
        scenario_config={"duration_hours": 6, "wind_speed_kt": 90, "radius_km": 40},
        timestep_config={"timestep_minutes": 60},
        location=LOCATION,
        seed=1,
    )
    return engine, engine.run()


def _run_tsunami():
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-0000000000f3",
        disaster_type="tsunami",
        scenario_config={
            "duration_hours": 3,
            "source_latitude": 20.0,
            "source_longitude": 88.0,
            "initial_wave_height_m": 5.0,
        },
        timestep_config={"timestep_minutes": 30},
        location=LOCATION,
        seed=1,
    )
    return engine, engine.run()


def test_flood_hazard_footprint_repackages_hazard_state():
    engine, frames = _run_flood()
    footprint = build_hazard_footprint(frames[-1], model_identifier=engine.model.model_identifier)
    assert footprint.disaster_type == "flood"
    assert footprint.intensity == frames[-1].state.hazard_state["water_level_m"]
    assert footprint.intensity_units == "m"
    assert footprint.geometry == frames[-1].state.affected_area
    assert footprint.geometry["type"] == "Polygon"
    assert footprint.model_id == "flood-demo-v1"
    assert footprint.is_demo_model is True


def test_flood_hazard_footprint_falls_back_to_none_geometry_at_t0():
    engine, frames = _run_flood()
    footprint = build_hazard_footprint(frames[0], model_identifier=engine.model.model_identifier)
    # No rise yet at t0 -> affected_area is None and flood has no fallback point.
    assert footprint.geometry is None


def test_cyclone_hazard_footprint_uses_wind_speed_as_intensity():
    engine, frames = _run_cyclone()
    footprint = build_hazard_footprint(frames[-1], model_identifier=engine.model.model_identifier)
    assert footprint.disaster_type == "cyclone"
    assert footprint.intensity == frames[-1].state.hazard_state["wind_speed_kt"]
    assert footprint.intensity_units == "kt"
    assert footprint.geometry["type"] == "Polygon"
    assert footprint.model_id == "cyclone-demo-v1"


def test_storm_surge_reuses_cyclone_extractor():
    """storm_surge reuses CycloneModel (simulation/core/registry.py) — the
    hazard footprint extractor registry must reuse the same mapping."""
    from simulation.core.hazard_footprint import HAZARD_FOOTPRINT_EXTRACTORS

    assert HAZARD_FOOTPRINT_EXTRACTORS["storm_surge"] is HAZARD_FOOTPRINT_EXTRACTORS["cyclone"]


def test_tsunami_hazard_footprint_falls_back_to_source_point_before_affected_area():
    engine, frames = _run_tsunami()
    footprint = build_hazard_footprint(frames[0], model_identifier=engine.model.model_identifier)
    # t0: arrival_progress is 0 so affected_area is None, but the source
    # point is always known -> fallback Point geometry.
    assert frames[0].state.affected_area is None
    assert footprint.geometry is not None
    assert footprint.geometry["type"] == "Point"
    assert footprint.geometry["coordinates"] == [88.0, 20.0]


def test_unregistered_disaster_type_raises_not_silently_empty():
    engine, frames = _run_flood()
    frame = frames[-1]
    frame.state.disaster_type = "not_a_real_disaster_type"
    with pytest.raises(HazardFootprintError):
        build_hazard_footprint(frame, model_identifier="whatever")


def test_to_dict_round_trips_expected_keys():
    engine, frames = _run_flood()
    footprint = build_hazard_footprint(frames[-1], model_identifier=engine.model.model_identifier)
    payload = footprint.to_dict()
    assert set(payload) == {
        "disaster_type",
        "simulation_run_id",
        "frame_index",
        "geometry",
        "geometry_type",
        "intensity",
        "intensity_units",
        "model_id",
        "model_version",
        "is_demo_model",
    }
    assert payload["geometry_type"] == "Polygon"
