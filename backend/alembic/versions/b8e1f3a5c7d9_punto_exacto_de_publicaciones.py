"""punto exacto de publicaciones

Revision ID: b8e1f3a5c7d9
Revises: a6d2e8f4c1b9
Create Date: 2026-11-05 12:00:00.000000

- publications.latitude y publications.longitude (Numeric(9,6), NULL): punto exacto en el Mapa vivo.
  CHECK ck_publications_point: las dos nulas o las dos presentes, latitud entre -90 y 90 y longitud
  entre -180 y 180. La API las exige para EVENTO (dentro del Bajo Cauca). No se rellena nada: los
  eventos antiguos se completan al editarlos.
Reversible: el downgrade borra el CHECK y las dos columnas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8e1f3a5c7d9'
down_revision: Union[str, Sequence[str], None] = 'a6d2e8f4c1b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

POINT_CHECK = ("(latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL "
               "AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)")


def upgrade() -> None:
    op.add_column('publications', sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True))
    op.add_column('publications', sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True))
    op.create_check_constraint('ck_publications_point', 'publications', POINT_CHECK)


def downgrade() -> None:
    op.drop_constraint('ck_publications_point', 'publications', type_='check')
    op.drop_column('publications', 'longitude')
    op.drop_column('publications', 'latitude')
