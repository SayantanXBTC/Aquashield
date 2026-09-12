import os
import sys
from pathlib import Path

# See app/main.py — same repo-root sys.path bootstrap, needed here too since
# tests may import app.services.simulation_service (which imports
# simulation.*) without importing app.main first.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

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


def _test_user(uid: str):
    from app.core.auth import AuthenticatedUser

    return AuthenticatedUser(
        uid=uid, email=f"{uid}@example.test", name=uid, picture=None, sign_in_provider="password"
    )


TEST_USER = _test_user("test-user-a")
OTHER_USER = _test_user("test-user-b")
_TEST_UID_HEADER = "x-test-uid"


def _make_client(db_session, user):
    """A TestClient whose requests all run inside db_session's transaction,
    so API-level tests get the same per-test isolation as db_session — every
    change, including what a request's own get_db-scoped session commits, is
    rolled back after the test.

    Auth is a hard requirement on every scenario/run route. Tests don't mint
    real Firebase tokens: `get_current_user` is replaced with a resolver
    that reads a test-only header the client sets by default, so two clients
    (`client`, `other_user_client`) can coexist in one test with different
    verified uids."""
    from fastapi import Request
    from fastapi.testclient import TestClient

    from app.core.auth import get_current_user
    from app.db.session import get_db
    from app.main import app

    def override_get_db():
        yield db_session

    def override_current_user(request: Request):
        return _test_user(request.headers.get(_TEST_UID_HEADER, TEST_USER.uid))

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    with TestClient(app, headers={_TEST_UID_HEADER: user.uid}) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def client(db_session):
    yield from _make_client(db_session, TEST_USER)


@pytest.fixture()
def other_user_client(db_session):
    """Same transaction as `client`, different verified uid — for
    user-isolation assertions."""
    yield from _make_client(db_session, OTHER_USER)
