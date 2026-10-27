"""lugares y favoritos de talento

Revision ID: a7c3e9f1b5d2
Revises: f2b8d5a9c3e7
Create Date: 2026-10-26 18:00:00.000000

Solo crea tablas nuevas:
- talent_venues: "Donde se ha presentado" (ON DELETE CASCADE con el talento).
- talent_favorites: talento guardado por un ciudadano (PK user_id + talent_id).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c3e9f1b5d2'
down_revision: Union[str, Sequence[str], None] = 'f2b8d5a9c3e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'talent_venues',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('talent_id', sa.Integer(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('municipality', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['talent_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_talent_venues_talent_id', 'talent_venues', ['talent_id'], unique=False)
    op.create_table(
        'talent_favorites',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('talent_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['talent_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'talent_id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('talent_favorites')
    op.drop_index('ix_talent_venues_talent_id', table_name='talent_venues')
    op.drop_table('talent_venues')
