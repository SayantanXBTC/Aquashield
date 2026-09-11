"""Integration tests for the hazard-footprint/exposure/impact endpoints
(Prompt 10) — requires real PostgreSQL/PostGIS, exercises the actual
simulation engine + PostGIS spatial queries end to end (not mocked)."""

from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from app.db.models.enums import AssetCriticality, AssetType
from app.db.models.infrastructure_asset import InfrastructureAsset
from tests.conftest import requires_postgres

LOCATION = {"latitude": 22.5, "longitude": 88.3}


def _create_scenario(client, *, disaster_type="flood", scenario_config=None):
    payload = {
        "name": f"Geo test {disaster_type}",
        "disaster_type": disaster_type,
        "location_name": "Test Location",
        "latitude": LOCATION["latitude"],
        "longitude": LOCATION["longitude"],
        "scenario_config": scenario_config
        or {
            "duration_hours": 6,
            "river_level_m": 1.0,
            "water_rise_rate_m_per_hr": 0.5,
            "drainage_capacity_pct": 0,
        },
    }
    response = client.post("/scenarios", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _create_and_execute_run(client, scenario_id):
    run = client.post(
        f"/scenarios/{scenario_id}/runs", json={"timestep_config": {"timestep_minutes": 60}}
    ).json()
    executed = client.post(f"/simulation-runs/{run['id']}/execute")
    assert executed.status_code == 200, executed.text
    return executed.json()


@requires_postgres
def test_hazard_footprints_endpoint_returns_one_per_frame(client):
    scenario = _create_scenario(client)
    run = _create_and_execute_run(client, scenario["id"])

    response = client.get(f"/simulation-runs/{run['id']}/hazard-footprints")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["frame_count"] == len(body["footprints"]) > 1
    last = body["footprints"][-1]
    assert last["disaster_type"] == "flood"
    assert last["intensity_units"] == "m"
    assert last["model_id"] == "flood-demo-v1"
    assert last["is_demo_model"] is True
    assert last["geometry"]["type"] == "Polygon"


@requires_postgres
def test_hazard_footprints_empty_before_execution(client):
    scenario = _create_scenario(client)
    run = client.post(
        f"/scenarios/{scenario['id']}/runs", json={"timestep_config": {"timestep_minutes": 60}}
    ).json()

    response = client.get(f"/simulation-runs/{run['id']}/hazard-footprints")
    assert response.status_code == 200
    assert response.json() == {
        "simulation_run_id": run["id"],
        "frame_count": 0,
        "footprints": [],
    }


@requires_postgres
def test_exposure_endpoint_finds_intersecting_asset(client, db_session):
    # A hospital directly at the scenario's location — a flood's affected
    # radius grows from the scenario location, so once the run completes
    # this asset intersects the last frame's hazard footprint.
    asset = InfrastructureAsset(
        name="Exposure Test Hospital",
        asset_type=AssetType.HOSPITAL,
        criticality=AssetCriticality.CRITICAL,
        geometry=from_shape(Point(LOCATION["longitude"], LOCATION["latitude"]), srid=4326),
    )
    db_session.add(asset)
    db_session.commit()

    scenario = _create_scenario(client)
    run = _create_and_execute_run(client, scenario["id"])

    response = client.get(f"/simulation-runs/{run['id']}/exposure")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["data_quality"] == "available"
    names = {r["asset_name"] for r in body["exposure_results"]}
    assert "Exposure Test Hospital" in names
    hit = next(r for r in body["exposure_results"] if r["asset_name"] == "Exposure Test Hospital")
    assert hit["status"] == "within_hazard_footprint"
    assert hit["distance_km"] == 0.0


@requires_postgres
def test_exposure_endpoint_excludes_far_away_asset(client, db_session):
    far_asset = InfrastructureAsset(
        name="Far Away Asset",
        asset_type=AssetType.SHELTER,
        criticality=AssetCriticality.LOW,
        geometry=from_shape(Point(-10.0, -10.0), srid=4326),
    )
    db_session.add(far_asset)
    db_session.commit()

    scenario = _create_scenario(client)
    run = _create_and_execute_run(client, scenario["id"])

    response = client.get(f"/simulation-runs/{run['id']}/exposure")
    assert response.status_code == 200, response.text
    names = {r["asset_name"] for r in response.json()["exposure_results"]}
    assert "Far Away Asset" not in names


@requires_postgres
def test_impact_endpoint_happy_path_caches_on_second_call(client, db_session):
    asset = InfrastructureAsset(
        name="Impact Test Hospital",
        asset_type=AssetType.HOSPITAL,
        criticality=AssetCriticality.CRITICAL,
        geometry=from_shape(Point(LOCATION["longitude"], LOCATION["latitude"]), srid=4326),
    )
    db_session.add(asset)
    db_session.commit()

    scenario = _create_scenario(client)
    run = _create_and_execute_run(client, scenario["id"])

    first = client.get(f"/simulation-runs/{run['id']}/impact")
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert first_body["data_quality"] == "available"
    assert first_body["cached"] is False
    assert first_body["exposed_asset_count"] >= 1
    assert first_body["risk_assessment_id"] is not None
    assert first_body["is_demo_model"] is True

    second = client.get(f"/simulation-runs/{run['id']}/impact")
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["cached"] is True
    assert second_body["risk_assessment_id"] == first_body["risk_assessment_id"]


@requires_postgres
def test_impact_missing_data_before_execution(client):
    scenario = _create_scenario(client)
    run = client.post(
        f"/scenarios/{scenario['id']}/runs", json={"timestep_config": {"timestep_minutes": 60}}
    ).json()

    response = client.get(f"/simulation-runs/{run['id']}/impact")
    assert response.status_code == 200
    body = response.json()
    assert body["data_quality"] == "unavailable"
    assert body["exposed_asset_count"] == 0
    assert body["hazard_footprint"] is None


@requires_postgres
def test_impact_frame_not_found_returns_404(client):
    scenario = _create_scenario(client)
    run = _create_and_execute_run(client, scenario["id"])

    response = client.get(f"/simulation-runs/{run['id']}/impact/frames/9999")
    assert response.status_code == 404
