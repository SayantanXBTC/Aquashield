from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

from tests.conftest import requires_postgres

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _alembic_head_revision() -> str:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    script = ScriptDirectory.from_config(config)
    return script.get_current_head()


def test_alembic_has_exactly_one_head() -> None:
    """Guards against an accidental branched migration history."""
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    script = ScriptDirectory.from_config(config)
    assert len(script.get_heads()) == 1


@requires_postgres
def test_database_is_at_alembic_head(engine) -> None:
    with engine.connect() as connection:
        row = connection.execute(text("SELECT version_num FROM alembic_version")).fetchone()
    assert row is not None, "alembic_version has no row — run `alembic upgrade head`"
    assert row[0] == _alembic_head_revision()
