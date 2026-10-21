"""slug de artista unico (sin distinguir mayusculas)

Revision ID: a1c4e7f2b9d3
Revises: 7fcef51b97b2
Create Date: 2026-10-20 12:00:00.000000

Indice funcional sobre lower(slug): autogenerate no detecta indices funcionales, por eso
se escribe a mano. Antes de aplicarlo no puede haber slugs repetidos (ignorando mayusculas).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4e7f2b9d3'
down_revision: Union[str, Sequence[str], None] = '7fcef51b97b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index('uq_artists_slug_lower', 'artists', [sa.text('lower(slug)')], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_artists_slug_lower', table_name='artists')
