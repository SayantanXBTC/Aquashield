import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings
from app.db import models  # noqa: F401 — populates Base.metadata
from app.db.base import Base

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", settings.database_url)


def _db_available() -> bool:
    try:
        engine = create_engine(TEST_DATABASE_URL)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        engine.dispose()
        return True
    except Exception:
        return False


requires_postgres = pytest.mark.skipif(
    not _db_available(),
    reason=(
        "PostgreSQL/PostGIS not reachable at DATABASE_URL/TEST_DATABASE_URL. "
        "Start it — see docs/development/database.md — these tests need real "
        "PostGIS support and are intentionally not run against SQLite."
    ),
)


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DATABASE_URL)
    # No-op if the schema is already migrated; ensures tables exist when
    # tests run against a fresh database that hasn't been migrated yet.
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    """A session whose changes (including any internal .commit() calls, e.g.
    in app.db.seed) are fully undone after the test — SQLAlchemy 2.0's
    join_transaction_mode="create_savepoint" pattern."""
    connection = engine.connect()
    outer_transaction = connection.begin()
    session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")
    session = session_factory()
    yield session
    session.close()
    outer_transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    """A TestClient whose requests all run inside db_session's transaction,
    so API-level tests get the same per-test isolation as db_session — every
    change, including what a request's own get_db-scoped session commits, is
    rolled back after the test."""
    from fastapi.testclient import TestClient

    from app.db.session import get_db
    from app.main import app

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)
