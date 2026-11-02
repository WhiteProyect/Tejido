"""municipio en publicaciones y artistas

Revision ID: c5e8a1d4f7b2
Revises: b3d9f2a6c8e4
Create Date: 2026-10-30 12:00:00.000000

- publications.municipality y artists.municipality: uno de los 6 slugs (CHECK) o NULL, con
  indice. NULL mientras se rellenan las filas existentes con scripts/backfill_municipality.py
  (la API ya exige el municipio al crear y editar). El NOT NULL va en otra migracion, despues
  del relleno.
- artists.moneystack: pertenece al sello (NOT NULL, por defecto true: hoy todos lo son).
No rellena datos. Reversible: el downgrade borra las columnas, sus indices y los CHECK.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5e8a1d4f7b2'
down_revision: Union[str, Sequence[str], None] = 'b3d9f2a6c8e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Los mismos de backend/service/schemas/municipalities.py (fijos aqui: una migracion no cambia si
# luego cambia el codigo).
MUNICIPALITIES = ('caucasia', 'caceres', 'taraza', 'nechi', 'elbagre', 'zaragoza')
CHECK = "municipality IS NULL OR municipality IN ({})".format(", ".join(f"'{slug}'" for slug in MUNICIPALITIES))


def upgrade() -> None:
    """Upgrade schema."""
    for table in ('publications', 'artists'):
        op.add_column(table, sa.Column('municipality', sa.String(), nullable=True))
        op.create_check_constraint(f'ck_{table}_municipality', table, CHECK)
        op.create_index(f'ix_{table}_municipality', table, ['municipality'])
    op.add_column('artists', sa.Column('moneystack', sa.Boolean(), server_default=sa.text('true'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('artists', 'moneystack')
    for table in ('artists', 'publications'):
        op.drop_index(f'ix_{table}_municipality', table_name=table)
        op.drop_constraint(f'ck_{table}_municipality', table, type_='check')
        op.drop_column(table, 'municipality')
