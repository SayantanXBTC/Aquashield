"""Structure exposure rules (simulation/core/structures.py) — demo world."""

from simulation.core.engine import SimulationEngine
from simulation.core.structures import HazardGeometry, exposure_for, status_for

STRUCTURES = [
    {"id": "port", "type": "port", "name": "Port", "x_km": 192.0, "y_km": 150.0, "enabled": True},
    {"id": "town", "type": "building", "name": "Town", "x_km": 197.0, "y_km": 152.0, "enabled": True},
    {"id": "far", "type": "hospital", "name": "Far", "x_km": 260.0, "y_km": 40.0, "enabled": True},
    {"id": "off", "type": "fuel_terminal", "name": "Off", "x_km": 191.0, "y_km": 150.0, "enabled": False},
]


def _run(disaster_type, **config):
    engine = SimulationEngine(
        simulation_run_id="00000000-0000-0000-0000-0000000000aa",
        disaster_type=disaster_type,
        scenario_config={"duration_hours": 3, "origin_x_km": 150, "origin_y_km": 150, "heading_deg": 90, "structures": STRUCTURES, **config},
        timestep_config={"timestep_minutes": 15},
        location=None,
        seed=1,
    )
    return engine.run()


def test_status_bands():
    assert status_for(0.0) == "clear"
    assert status_for(0.2) == "at_risk"
    assert status_for(0.5) == "impacted"
    assert status_for(0.9) == "severe"


def test_disabled_structures_are_not_assessed():
    frames = _run("tsunami", speed_kmh=500, intensity=0.8)
    ids = {i["structure_id"] for i in frames[-1].state.infrastructure_impacts}
    assert ids == {"port", "town", "far"}


def test_tsunami_exposes_coast_after_landfall_only():
    frames = _run("tsunami", speed_kmh=500, intensity=0.8, spread_radius_km=14)
    before = next(f for f in frames if not f.state.hazard_state["arrived"])
    assert all(i["exposure"] == 0.0 for i in before.state.infrastructure_impacts)
    last = {i["structure_id"]: i for i in frames[-1].state.infrastructure_impacts}
    assert last["port"]["exposure"] > last["town"]["exposure"] > 0.0
    assert last["far"]["exposure"] == 0.0


def test_cyclone_exposure_falls_off_with_distance_to_eye():
    g = HazardGeometry(kind="cyclone", origin_x_km=0, origin_y_km=0, position_x_km=190, position_y_km=150, heading_deg=90, arrived=True, coast_distance_total_km=40, traveled_km=40, spread_radius_km=70, radius_km=70, scale=0.8)
    _, near = exposure_for(g, 192, 150)
    _, mid = exposure_for(g, 230, 150)
    _, outside = exposure_for(g, 270, 150)
    assert near > mid > 0.0
    assert outside == 0.0


def test_oil_only_reaches_coastal_structures():
    g = HazardGeometry(kind="oil_spill", origin_x_km=0, origin_y_km=0, position_x_km=191, position_y_km=150, heading_deg=90, arrived=True, coast_distance_total_km=1, traveled_km=1, spread_radius_km=18, radius_km=10, scale=0.6)
    _, coastal = exposure_for(g, 192, 150)
    _, inland = exposure_for(g, 199, 150)  # ~7 km inland, inside the radius but not coastal
    assert coastal > 0.0
    assert inland == 0.0


def test_flood_exposure_needs_inundation_and_lateral_proximity():
    frames = _run("coastal_flood", speed_kmh=60, intensity=0.8, spread_radius_km=12)
    last = {i["structure_id"]: i for i in frames[-1].state.infrastructure_impacts}
    assert last["port"]["status"] in {"impacted", "severe"}
    assert last["far"]["exposure"] == 0.0
