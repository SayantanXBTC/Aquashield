"""Scenarios and runs are private to the authenticated owner."""

from tests.conftest import requires_postgres

pytestmark = requires_postgres


def _create(client, name="Private test"):
    response = client.post(
        "/scenarios",
        json={"name": name, "disaster_type": "tsunami", "scenario_config": {"origin_x_km": 60, "heading_deg": 90}},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_other_user_cannot_see_or_touch_scenario(client, other_user_client):
    scenario = _create(client)
    scenario_id = scenario["id"]

    mine = client.get("/scenarios").json()
    assert [s["id"] for s in mine["items"]] == [scenario_id]

    theirs = other_user_client.get("/scenarios").json()
    assert theirs["items"] == []
    assert other_user_client.get(f"/scenarios/{scenario_id}").status_code == 404
    assert other_user_client.patch(f"/scenarios/{scenario_id}", json={"name": "x"}).status_code == 404
    assert other_user_client.post(f"/scenarios/{scenario_id}/runs", json={}).status_code == 404


def test_other_user_cannot_read_or_execute_run(client, other_user_client):
    scenario = _create(client)
    run = client.post(f"/scenarios/{scenario['id']}/runs", json={}).json()
    assert other_user_client.get(f"/simulation-runs/{run['id']}").status_code == 404
    assert other_user_client.post(f"/simulation-runs/{run['id']}/execute").status_code == 404
    assert client.post(f"/simulation-runs/{run['id']}/execute").status_code == 200


def test_unauthenticated_request_is_rejected(db_session):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as anonymous:
        assert anonymous.get("/scenarios").status_code == 401
