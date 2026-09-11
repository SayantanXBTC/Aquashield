import uuid

import pytest

from app.db.models.enums import DisasterType
from tests.conftest import requires_postgres

# Valid scenario_config per disaster type — mirrors
# backend/tests/schemas/test_scenario_config.py's VALID_CONFIG_BY_TYPE
# (kept separate: that file is a pure schema unit test, this exercises the
# full HTTP create path across every type).
VALID_CONFIG_BY_DISASTER_TYPE = {
    "flood": {"rainfall_mm_24h": 150, "river_level_m": 5.0},
    "flash_flood": {"rainfall_mm_24h": 220, "water_rise_rate_m_per_hr": 0.6},
    "coastal_flood": {"river_level_m": 4.0, "drainage_capacity_pct": 25},
    "storm_surge": {"central_pressure_hpa": 955, "wind_speed_kt": 85},
    "cyclone": {"central_pressure_hpa": 930, "wind_speed_kt": 110, "radius_km": 150},
    "tsunami": {"magnitude": 7.8, "initial_wave_height_m": 3.5},
    "oil_spill": {"spill_volume_tonnes": 500, "oil_type": "crude"},
    "chemical_pollution": {"spill_volume_tonnes": 300, "wind_speed_kt": 8},
    "search_rescue": {"search_radius_km": 6, "vessel_type": "fishing_trawler"},
}

FLOOD_PAYLOAD = {
    "name": "Test Flood Scenario",
    "disaster_type": "flood",
    "location_name": "Test City",
    "latitude": 23.8,
    "longitude": 90.4,
    "scenario_config": {"rainfall_mm_24h": 150, "river_level_m": 5.0},
}


@requires_postgres
def test_create_scenario_creates_scenario_and_initial_version(client) -> None:
    response = client.post("/scenarios", json=FLOOD_PAYLOAD)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Test Flood Scenario"
    assert body["disaster_type"] == "flood"
    assert body["version_count"] == 1
    assert body["current_version"]["version_number"] == 1
    assert body["current_version"]["scenario_config"]["rainfall_mm_24h"] == 150.0


@requires_postgres
def test_get_scenario_returns_created_scenario(client) -> None:
    created = client.post("/scenarios", json=FLOOD_PAYLOAD).json()
    response = client.get(f"/scenarios/{created['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


@requires_postgres
def test_list_scenarios_returns_paginated_page(client) -> None:
    client.post("/scenarios", json=FLOOD_PAYLOAD)
    response = client.get("/scenarios")
    assert response.status_code == 200
    body = response.json()
    assert "items" in body and "total" in body and "limit" in body and "offset" in body
    assert body["total"] >= 1


@requires_postgres
def test_list_scenarios_filters_by_disaster_type(client) -> None:
    client.post("/scenarios", json=FLOOD_PAYLOAD)
    created = client.post(
        "/scenarios", json={**FLOOD_PAYLOAD, "name": "Test Tsunami Filter", "disaster_type": "tsunami"}
    ).json()

    response = client.get("/scenarios", params={"disaster_type": "tsunami", "limit": 100})
    body = response.json()
    assert any(item["id"] == created["id"] for item in body["items"])
    assert all(item["disaster_type"] == "tsunami" for item in body["items"])


@requires_postgres
def test_list_scenarios_filters_by_status(client) -> None:
    created = client.post("/scenarios", json=FLOOD_PAYLOAD).json()
    client.delete(f"/scenarios/{created['id']}")  # archives it

    response = client.get("/scenarios", params={"status": "archived"})
    body = response.json()
    assert any(item["id"] == created["id"] for item in body["items"])
    assert all(item["status"] == "archived" for item in body["items"])


@requires_postgres
def test_update_scenario_config_creates_new_version(client) -> None:
    created = client.post("/scenarios", json=FLOOD_PAYLOAD).json()
    scenario_id = created["id"]

    response = client.patch(
        f"/scenarios/{scenario_id}", json={"scenario_config": {"rainfall_mm_24h": 300}}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["version_count"] == 2
    assert body["current_version"]["version_number"] == 2
    assert body["current_version"]["scenario_config"]["rainfall_mm_24h"] == 300.0


@requires_postgres
def test_historical_version_remains_unchanged_after_update(client) -> None:
    created = client.post("/scenarios", json=FLOOD_PAYLOAD).json()
    scenario_id = created["id"]

    client.patch(f"/scenarios/{scenario_id}", json={"scenario_config": {"rainfall_mm_24h": 300}})

    versions = client.get(f"/scenarios/{scenario_id}/versions").json()
    assert len(versions) == 2
    v1 = next(v for v in versions if v["version_number"] == 1)
    assert v1["scenario_config"]["rainfall_mm_24h"] == 150.0


@requires_postgres
def test_duplicate_scenario_creates_new_identity(client) -> None:
    created = client.post("/scenarios", json=FLOOD_PAYLOAD).json()
    scenario_id = created["id"]

    response = client.post(f"/scenarios/{scenario_id}/duplicate")
    assert response.status_code == 201
    duplicate = response.json()
    assert duplicate["id"] != scenario_id
    assert duplicate["name"] == f"{created['name']} (Copy)"
    assert duplicate["current_version"]["scenario_config"] == created["current_version"]["scenario_config"]


@requires_postgres
def test_create_simulation_run_creates_pending_run(client) -> None:
    created = client.post("/scenarios", json=FLOOD_PAYLOAD).json()
    scenario_id = created["id"]

    response = client.post(f"/scenarios/{scenario_id}/runs")
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["scenario_version_id"] == created["current_version"]["id"]
    assert "not yet executed" in body["message"]


@requires_postgres
def test_get_simulation_runs_returns_created_run(client) -> None:
    created = client.post("/scenarios", json=FLOOD_PAYLOAD).json()
    scenario_id = created["id"]
    run = client.post(f"/scenarios/{scenario_id}/runs").json()

    response = client.get(f"/scenarios/{scenario_id}/runs")
    assert response.status_code == 200
    runs = response.json()
    assert any(r["id"] == run["id"] for r in runs)


@requires_postgres
def test_create_scenario_rejects_invalid_disaster_type(client) -> None:
    response = client.post("/scenarios", json={**FLOOD_PAYLOAD, "disaster_type": "meteor_strike"})
    assert response.status_code == 422


@requires_postgres
def test_create_scenario_rejects_invalid_coordinates(client) -> None:
    response = client.post("/scenarios", json={**FLOOD_PAYLOAD, "latitude": 999, "longitude": 0})
    assert response.status_code == 422


@requires_postgres
def test_create_scenario_rejects_missing_required_fields(client) -> None:
    response = client.post("/scenarios", json={"disaster_type": "flood"})  # no name
    assert response.status_code == 422


@requires_postgres
def test_create_scenario_rejects_empty_name(client) -> None:
    response = client.post("/scenarios", json={**FLOOD_PAYLOAD, "name": ""})
    assert response.status_code == 422


@requires_postgres
def test_get_scenario_not_found_returns_404(client) -> None:
    response = client.get(f"/scenarios/{uuid.uuid4()}")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@requires_postgres
def test_create_simulation_run_for_missing_scenario_returns_404(client) -> None:
    response = client.post(f"/scenarios/{uuid.uuid4()}/runs")
    assert response.status_code == 404


@requires_postgres
@pytest.mark.parametrize("disaster_type", [dt.value for dt in DisasterType])
def test_create_scenario_succeeds_for_every_disaster_type(client, disaster_type: str) -> None:
    payload = {
        "name": f"Test {disaster_type} scenario",
        "disaster_type": disaster_type,
        "location_name": "Test Location",
        "latitude": 22.5,
        "longitude": 88.3,
        "scenario_config": VALID_CONFIG_BY_DISASTER_TYPE[disaster_type],
    }
    response = client.post("/scenarios", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["disaster_type"] == disaster_type
    assert body["status"] == "ready"  # config was populated
    assert body["current_version"]["version_number"] == 1


@requires_postgres
def test_create_scenario_with_empty_config_stays_draft_for_a_non_flood_type(client) -> None:
    """Regression for a type other than flood/oil_spill — the draft/ready
    transition isn't accidentally flood-specific."""
    response = client.post(
        "/scenarios",
        json={
            "name": "Test Draft Search & Rescue",
            "disaster_type": "search_rescue",
            "scenario_config": {},
        },
    )
    assert response.status_code == 201
    assert response.json()["status"] == "draft"


@requires_postgres
def test_update_scenario_config_creates_new_version_for_non_flood_non_oil_spill_type(client) -> None:
    """Scenario versioning (config change -> new immutable ScenarioVersion,
    CLAUDE.md §25) must keep working for every disaster type, not just the
    two the earlier tests happened to cover."""
    created = client.post(
        "/scenarios",
        json={
            "name": "Test Search & Rescue Versioning",
            "disaster_type": "search_rescue",
            "scenario_config": {"search_radius_km": 5},
        },
    ).json()
    scenario_id = created["id"]
    assert created["current_version"]["version_number"] == 1

    response = client.patch(
        f"/scenarios/{scenario_id}", json={"scenario_config": {"search_radius_km": 12}}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["version_count"] == 2
    assert body["current_version"]["version_number"] == 2
    assert body["current_version"]["scenario_config"]["search_radius_km"] == 12.0

    versions = client.get(f"/scenarios/{scenario_id}/versions").json()
    assert len(versions) == 2
    v1 = next(v for v in versions if v["version_number"] == 1)
    # The original version is never mutated in place.
    assert v1["scenario_config"]["search_radius_km"] == 5.0
