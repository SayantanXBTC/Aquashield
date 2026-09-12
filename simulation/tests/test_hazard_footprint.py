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
        scenario_config={"duration_hours": 4, "origin_x_km": 150, "origin_y_km": 150, "heading_deg": 90, "speed_kmh": 80},
        timestep_config={"timestep_minutes": 60},
        location=LOCATION,
        seed=1,
    )
    return engine, engine.run()


def _run_cyclone():
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-0000000000f2",
        disaster_type="cyclone",
        scenario_config={"duration_hours": 6, "intensity": 0.5, "spread_radius_km": 40},
        timestep_config={"timestep_minutes": 60},
        location=LOCATION,
        seed=1,
    )
    return engine, engine.run()


def _run_tsunami():
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-0000000000f3",
        disaster_type="tsunami",
        scenario_config={"duration_hours": 3, "origin_x_km": 45, "origin_y_km": 140, "speed_kmh": 500},
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
    # Demo-world models emit no real-world geometry (Prompt 12).
    assert frames[-1].state.affected_area is None
    assert footprint.geometry is None
    assert footprint.model_id == "coastal-flood-demo-v2"
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
    assert footprint.geometry is None
    assert footprint.model_id == "cyclone-demo-v2"


def test_storm_surge_reuses_cyclone_extractor():
    """storm_surge reuses CycloneModel (simulation/core/registry.py) — the
    hazard footprint extractor registry must reuse the same mapping."""
    from simulation.core.hazard_footprint import HAZARD_FOOTPRINT_EXTRACTORS

    assert HAZARD_FOOTPRINT_EXTRACTORS["storm_surge"] is HAZARD_FOOTPRINT_EXTRACTORS["cyclone"]


def test_tsunami_hazard_footprint_has_no_real_world_geometry():
    engine, frames = _run_tsunami()
    footprint = build_hazard_footprint(frames[-1], model_identifier=engine.model.model_identifier)
    # The demo-world source is in km, not lat/lon — no fallback Point is
    # fabricated from it.
    assert frames[-1].state.affected_area is None
    assert footprint.geometry is None
    assert footprint.intensity == frames[-1].state.hazard_state["coastal_impact_m"]


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
    assert payload["geometry_type"] is None
