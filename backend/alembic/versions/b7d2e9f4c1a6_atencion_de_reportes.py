"""atencion de reportes: nota y fecha de resolucion

Revision ID: b7d2e9f4c1a6
Revises: a1c4e7f2b9d3
Create Date: 2026-10-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d2e9f4c1a6'
down_revision: Union[str, Sequence[str], None] = 'a1c4e7f2b9d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('reports', sa.Column('resolution_note', sa.Text(), nullable=True))
    op.add_column('reports', sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('reports', 'resolved_at')
    op.drop_column('reports', 'resolution_note')
