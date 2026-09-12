"""ai_requests audit table (multi-agent AI layer)

Revision ID: 7c4e2a91b3d5
Revises: 5b2f9c1d7e10
Create Date: 2026-09-12 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '7c4e2a91b3d5'
down_revision: Union[str, Sequence[str], None] = '5b2f9c1d7e10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'ai_requests',
        sa.Column('owner_uid', sa.String(length=128), nullable=False),
        sa.Column('scenario_id', sa.Uuid(), nullable=False),
        sa.Column('simulation_run_id', sa.Uuid(), nullable=False),
        sa.Column('frame_index', sa.Integer(), nullable=False),
        sa.Column('user_question', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', name='ai_request_status'), nullable=False),
        sa.Column('provider', sa.String(length=64), nullable=True),
        sa.Column('model', sa.String(length=128), nullable=True),
        sa.Column('prompt_version', sa.String(length=64), nullable=True),
        sa.Column('agent_versions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('tools_called', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('execution_ms', sa.Float(), nullable=True),
        sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['simulation_run_id'], ['simulation_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_requests_owner_uid'), 'ai_requests', ['owner_uid'], unique=False)
    op.create_index(op.f('ix_ai_requests_scenario_id'), 'ai_requests', ['scenario_id'], unique=False)
    op.create_index(op.f('ix_ai_requests_simulation_run_id'), 'ai_requests', ['simulation_run_id'], unique=False)
    op.create_index(op.f('ix_ai_requests_status'), 'ai_requests', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_ai_requests_status'), table_name='ai_requests')
    op.drop_index(op.f('ix_ai_requests_simulation_run_id'), table_name='ai_requests')
    op.drop_index(op.f('ix_ai_requests_scenario_id'), table_name='ai_requests')
    op.drop_index(op.f('ix_ai_requests_owner_uid'), table_name='ai_requests')
    op.drop_table('ai_requests')
    # The Postgres ENUM type is created by the column above and must be
    # dropped explicitly (docs/development/database.md).
    op.execute('DROP TYPE IF EXISTS ai_request_status')
