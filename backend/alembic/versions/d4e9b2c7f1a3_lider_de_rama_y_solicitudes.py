"""lider de rama y solicitudes de ingreso

Revision ID: d4e9b2c7f1a3
Revises: c3f8a1d5e7b2
Create Date: 2026-10-24 12:00:00.000000

- organizations.is_leader (false por defecto), con un indice unico parcial sobre branch
  WHERE is_leader (un lider por rama) y un CHECK (un lider siempre tiene rama).
- branch_join_requests: solicitudes de ciudadanos para participar en una rama, con un indice
  unico parcial (una pendiente por persona) y uno por (branch, status).
Sin datos sembrados.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e9b2c7f1a3'
down_revision: Union[str, Sequence[str], None] = 'c3f8a1d5e7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('organizations', sa.Column('is_leader', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.create_index('uq_organizations_branch_leader', 'organizations', ['branch'], unique=True,
                    postgresql_where=sa.text('is_leader'))
    op.create_check_constraint('ck_organizations_leader_has_branch', 'organizations',
                               'is_leader = false OR branch IS NOT NULL')

    op.create_table(
        'branch_join_requests',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('branch', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('decided_by', sa.Integer(), nullable=True),
        sa.Column('decision_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['decided_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('uq_branch_join_requests_pending_user', 'branch_join_requests', ['user_id'], unique=True,
                    postgresql_where=sa.text("status = 'PENDING'"))
    op.create_index('ix_branch_join_requests_branch_status', 'branch_join_requests', ['branch', 'status'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_branch_join_requests_branch_status', table_name='branch_join_requests')
    op.drop_index('uq_branch_join_requests_pending_user', table_name='branch_join_requests')
    op.drop_table('branch_join_requests')
    op.drop_constraint('ck_organizations_leader_has_branch', 'organizations', type_='check')
    op.drop_index('uq_organizations_branch_leader', table_name='organizations')
    op.drop_column('organizations', 'is_leader')
