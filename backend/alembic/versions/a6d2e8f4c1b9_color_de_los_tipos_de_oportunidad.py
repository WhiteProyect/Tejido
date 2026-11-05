"""color de los tipos de oportunidad

Revision ID: a6d2e8f4c1b9
Revises: f3c1a9e7b5d2
Create Date: 2026-11-05 10:00:00.000000

- opportunity_types.color: color de la banda y la pildora del tipo, de una paleta cerrada (ocre, menta,
  morado, amarillo, crema; CHECK en la base). Los 5 tipos iniciales quedan: convocatoria=ocre,
  taller=menta, audicion=morado, concurso=amarillo, curso=crema; cualquier otro, ocre (el default).
Reversible: el downgrade borra la columna (y su CHECK).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a6d2e8f4c1b9'
down_revision: Union[str, Sequence[str], None] = 'f3c1a9e7b5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INITIAL_COLORS = {"convocatoria": "ocre", "taller": "menta", "audicion": "morado", "concurso": "amarillo", "curso": "crema"}


def upgrade() -> None:
    op.add_column('opportunity_types', sa.Column('color', sa.String(length=12), server_default=sa.text("'ocre'"), nullable=False))
    for slug, color in INITIAL_COLORS.items():
        op.execute(sa.text("UPDATE opportunity_types SET color = :color WHERE slug = :slug").bindparams(color=color, slug=slug))
    op.create_check_constraint('ck_opportunity_types_color', 'opportunity_types',
                               "color IN ('ocre', 'menta', 'morado', 'amarillo', 'crema')")


def downgrade() -> None:
    op.drop_constraint('ck_opportunity_types_color', 'opportunity_types', type_='check')
    op.drop_column('opportunity_types', 'color')
