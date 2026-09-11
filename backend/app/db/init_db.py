from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db.session import engine


def check_connection(target_engine: Engine = engine) -> bool:
    """Verify the database is reachable. Raises on failure — callers decide how to report it."""
    with target_engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return True
