"""texto de tradicion de eventos

Revision ID: e8b3c5d7f9a2
Revises: d4f6a8c1e3b5
Create Date: 2026-11-03 20:00:00.000000

- publications.tradition_text: "Fecha habitual o tradicion" de un EVENTO que se repite (p. ej. "Cada
  20 de julio"), hasta 80 caracteres; NULL = sin texto. No se rellena nada.
Las reglas (recorte, sin HTML, maximo 80, solo EVENTO) se validan en la API
(services/publications.py). Reversible: el downgrade borra la columna.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8b3c5d7f9a2'
down_revision: Union[str, Sequence[str], None] = 'd4f6a8c1e3b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('publications', sa.Column('tradition_text', sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column('publications', 'tradition_text')
