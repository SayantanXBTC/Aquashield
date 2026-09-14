"""ai_requests: scenario_version_id + request_type (frame-synchronised AI)

Adds the two columns the command center's live analysis needs:

* `scenario_version_id` — the configuration version the operator was looking
  at when the analysis was requested. The service refuses a request whose
  version no longer matches the run's, so a brief never describes a
  configuration that has already been edited away.
* `request_type` — what triggered the analysis (playback | scrub | paused |
  complete | manual), so throttling behaviour is auditable after the fact.

Both are nullable: rows written before this migration have neither.

Revision ID: 9a1f63c05d72
Revises: 7c4e2a91b3d5
Create Date: 2026-09-12 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a1f63c05d72'
down_revision: Union[str, Sequence[str], None] = '7c4e2a91b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('ai_requests', sa.Column('scenario_version_id', sa.Uuid(), nullable=True))
    op.add_column('ai_requests', sa.Column('request_type', sa.String(length=32), nullable=True))
    op.create_index(op.f('ix_ai_requests_scenario_version_id'), 'ai_requests', ['scenario_version_id'], unique=False)
    op.create_foreign_key(
        'fk_ai_requests_scenario_version_id_scenario_versions',
        'ai_requests',
        'scenario_versions',
        ['scenario_version_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_ai_requests_scenario_version_id_scenario_versions', 'ai_requests', type_='foreignkey')
    op.drop_index(op.f('ix_ai_requests_scenario_version_id'), table_name='ai_requests')
    op.drop_column('ai_requests', 'request_type')
    op.drop_column('ai_requests', 'scenario_version_id')
