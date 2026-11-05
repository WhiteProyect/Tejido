"""eslogan y etiquetas de publicaciones

Revision ID: d4f6a8c1e3b5
Revises: c5e8a1d4f7b2
Create Date: 2026-11-03 12:00:00.000000

- publications.tagline: texto opcional de hasta 100 caracteres (NULL = sin eslogan).
- publications.tags: lista JSON de hasta 3 etiquetas, NOT NULL con '[]' por defecto (las publicaciones
  existentes quedan sin etiquetas; no se rellena nada).
Las reglas (recorte, sin duplicados, sin HTML, maximo 3 de 24 caracteres) se validan en la API
(services/publications.py). Reversible: el downgrade borra las dos columnas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4f6a8c1e3b5'
down_revision: Union[str, Sequence[str], None] = 'c5e8a1d4f7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('publications', sa.Column('tagline', sa.String(length=100), nullable=True))
    op.add_column('publications', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                                            server_default=sa.text("'[]'::jsonb")))


def downgrade() -> None:
    op.drop_column('publications', 'tags')
    op.drop_column('publications', 'tagline')
