"""scenario owner_uid (Firebase Authentication user isolation)

Revision ID: 5b2f9c1d7e10
Revises: 1ced82090d27
Create Date: 2026-09-12 11:05:00.000000

Adds the NOT NULL `scenarios.owner_uid` column that scopes every scenario
(and, through the FK chain, its versions/runs/artifacts) to one
authenticated Firebase user. Pre-existing scenario rows were wiped before
this migration (scripts/wipe_scenario_data.py) — there is no legacy data to
backfill, so the column can be NOT NULL from the start. If a deployment
ever needs to migrate un-owned rows, backfill a sentinel uid first.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b2f9c1d7e10'
down_revision: Union[str, Sequence[str], None] = '1ced82090d27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('scenarios', sa.Column('owner_uid', sa.String(length=128), nullable=False))
    op.create_index(op.f('ix_scenarios_owner_uid'), 'scenarios', ['owner_uid'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_scenarios_owner_uid'), table_name='scenarios')
    op.drop_column('scenarios', 'owner_uid')
