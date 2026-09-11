"""Integration tests for simulation run execution — requires real
PostgreSQL/PostGIS (backend/tests/conftest.py's `client`/`db_session`), and
exercises the actual simulation/ engine end to end (not mocked)."""

from app.db.models.enums import SimulationStatus
from tests.conftest import requires_postgres


def _create_scenario(client, *, disaster_type="flood", scenario_config=None):
    payload = {
        "name": f"Test {disaster_type}",
        "disaster_type": disaster_type,
        "location_name": "Test Location",
        "latitude": 22.5,
        "longitude": 88.3,
        "scenario_config": scenario_config
        or {
            "duration_hours": 3,
            "river_level_m": 1.0,
            "water_rise_rate_m_per_hr": 0.5,
        },
    }
    response = client.post("/scenarios", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _create_run(client, scenario_id, *, timestep_config=None):
    response = client.post(
        f"/scenarios/{scenario_id}/runs",
        json={"timestep_config": timestep_config or {"timestep_minutes": 30}},
    )
    assert response.status_code == 201, response.text
    return response.json()


@requires_postgres
def test_execute_run_transitions_pending_to_completed(client):
    scenario = _create_scenario(client)
    run = _create_run(client, scenario["id"])
    assert run["status"] == SimulationStatus.PENDING.value

    response = client.post(f"/simulation-runs/{run['id']}/execute")
    assert response.status_code == 200, response.text
    detail = response.json()

    assert detail["status"] == SimulationStatus.COMPLETED.value
    assert detail["model_identifier"] == "flood-demo-v1"
    assert detail["started_at"] is not None
    assert detail["completed_at"] is not None
    assert detail["duration_seconds"] is not None
    assert detail["artifact"] is not None
    assert detail["frame_count"] and detail["frame_count"] > 1


@requires_postgres
def test_get_run_returns_detail(client):
    scenario = _create_scenario(client)
    run = _create_run(client, scenario["id"])
    client.post(f"/simulation-runs/{run['id']}/execute")

    response = client.get(f"/simulation-runs/{run['id']}")
    assert response.status_code == 200
    assert response.json()["status"] == SimulationStatus.COMPLETED.value


@requires_postgres
def test_timeline_has_multiple_changing_frames(client):
    scenario = _create_scenario(client)
    run = _create_run(client, scenario["id"])
    client.post(f"/simulation-runs/{run['id']}/execute")

    response = client.get(f"/simulation-runs/{run['id']}/timeline")
    assert response.status_code == 200
    body = response.json()
    frames = body["frames"]
    assert body["frame_count"] == len(frames)
    assert len(frames) > 1

    levels = [f["state"]["hazard_state"]["water_level_m"] for f in frames]
    assert levels[0] != levels[-1]
    assert frames[0]["is_key_event"] is True
    assert frames[-1]["is_key_event"] is True


@requires_postgres
def test_execute_twice_returns_conflict(client):
    scenario = _create_scenario(client)
    run = _create_run(client, scenario["id"])
    first = client.post(f"/simulation-runs/{run['id']}/execute")
    assert first.status_code == 200

    second = client.post(f"/simulation-runs/{run['id']}/execute")
    assert second.status_code == 409


@requires_postgres
def test_execute_unknown_run_returns_404(client):
    response = client.post("/simulation-runs/00000000-0000-0000-0000-000000000000/execute")
    assert response.status_code == 404


@requires_postgres
def test_timeline_before_execution_is_empty(client):
    scenario = _create_scenario(client)
    run = _create_run(client, scenario["id"])

    response = client.get(f"/simulation-runs/{run['id']}/timeline")
    assert response.status_code == 200
    assert response.json()["frames"] == []


@requires_postgres
def test_rerun_same_scenario_version_is_deterministic(client):
    """Two separate runs created against the SAME ScenarioVersion, executed
    with the same (default) seed, must produce identical timelines — the
    reproducibility guarantee Prompt 7 §9/§29 requires."""
    scenario = _create_scenario(client)
    run_a = _create_run(client, scenario["id"])
    run_b = _create_run(client, scenario["id"])

    client.post(f"/simulation-runs/{run_a['id']}/execute")
    client.post(f"/simulation-runs/{run_b['id']}/execute")

    timeline_a = client.get(f"/simulation-runs/{run_a['id']}/timeline").json()["frames"]
    timeline_b = client.get(f"/simulation-runs/{run_b['id']}/timeline").json()["frames"]

    states_a = [f["state"]["hazard_state"] for f in timeline_a]
    states_b = [f["state"]["hazard_state"] for f in timeline_b]
    assert states_a == states_b


@requires_postgres
def test_different_scenario_config_produces_different_output(client):
    scenario_a = _create_scenario(
        client,
        scenario_config={"duration_hours": 3, "river_level_m": 1.0, "water_rise_rate_m_per_hr": 0.5},
    )
    scenario_b = _create_scenario(
        client,
        scenario_config={"duration_hours": 3, "river_level_m": 1.0, "water_rise_rate_m_per_hr": 2.0},
    )
    run_a = _create_run(client, scenario_a["id"])
    run_b = _create_run(client, scenario_b["id"])

    client.post(f"/simulation-runs/{run_a['id']}/execute")
    client.post(f"/simulation-runs/{run_b['id']}/execute")

    timeline_a = client.get(f"/simulation-runs/{run_a['id']}/timeline").json()["frames"]
    timeline_b = client.get(f"/simulation-runs/{run_b['id']}/timeline").json()["frames"]

    assert timeline_a[-1]["state"]["hazard_state"] != timeline_b[-1]["state"]["hazard_state"]


@requires_postgres
def test_execute_different_disaster_types_end_to_end(client):
    for disaster_type, config in [
        ("tsunami", {"duration_hours": 2, "initial_wave_height_m": 3.0, "magnitude": 8.0}),
        ("cyclone", {"duration_hours": 4, "wind_speed_kt": 90, "radius_km": 50}),
        (
            "oil_spill",
            {
                "duration_hours": 4,
                "spill_volume_tonnes": 200,
                "wind_speed_kt": 10,
                "current_speed_kt": 1.0,
            },
        ),
        ("search_rescue", {"duration_hours": 3, "search_radius_km": 4}),
    ]:
        scenario = _create_scenario(client, disaster_type=disaster_type, scenario_config=config)
        run = _create_run(client, scenario["id"])
        response = client.post(f"/simulation-runs/{run['id']}/execute")
        assert response.status_code == 200, f"{disaster_type}: {response.text}"
        assert response.json()["status"] == SimulationStatus.COMPLETED.value
