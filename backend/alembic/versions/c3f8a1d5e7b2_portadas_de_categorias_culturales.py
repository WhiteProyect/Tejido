"""portadas de categorias culturales

Revision ID: c3f8a1d5e7b2
Revises: b7d2e9f4c1a6
Create Date: 2026-10-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f8a1d5e7b2'
down_revision: Union[str, Sequence[str], None] = 'b7d2e9f4c1a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'cultural_category_covers',
        sa.Column('category_key', sa.String(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('category_key'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('cultural_category_covers')
