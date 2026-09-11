from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import requires_postgres

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "aquashield-backend"}


@requires_postgres
def test_health_db_returns_ok_when_reachable() -> None:
    response = client.get("/health/db")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "reachable"}
