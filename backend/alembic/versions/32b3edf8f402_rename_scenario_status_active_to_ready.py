"""rename scenario_status active to ready

Revision ID: 32b3edf8f402
Revises: 34d773b93c0a
Create Date: 2026-09-11 23:22:50.200658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32b3edf8f402'
down_revision: Union[str, Sequence[str], None] = '34d773b93c0a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    SQLAlchemy's Enum(PythonEnum) stores the Python member NAME as the
    Postgres label by default (not .value) — so the existing label here is
    'ACTIVE', not 'active'.
    """
    op.execute("ALTER TYPE scenario_status RENAME VALUE 'ACTIVE' TO 'READY'")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TYPE scenario_status RENAME VALUE 'READY' TO 'ACTIVE'")
