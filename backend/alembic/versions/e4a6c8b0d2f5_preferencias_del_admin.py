"""preferencias del admin (Pulso personalizable)

Tabla admin_preferences: una fila por admin con la lista ordenada de tarjetas visibles del Pulso del
dashboard (pulso, JSONB) y updated_at. Sin fila = Pulso por defecto. Se borra con el usuario (CASCADE).
No toca datos existentes.

Revision ID: e4a6c8b0d2f5
Revises: d9a3b5c7e1f4
Create Date: 2026-11-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e4a6c8b0d2f5'
down_revision: Union[str, Sequence[str], None] = 'd9a3b5c7e1f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'admin_preferences',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('pulso', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('admin_preferences')
