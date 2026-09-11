from app.config.settings import settings
from app.db.init_db import check_connection
from tests.conftest import requires_postgres


def test_database_url_is_configured() -> None:
    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.postgres_db in settings.database_url


@requires_postgres
def test_database_connection_succeeds() -> None:
    assert check_connection() is True
