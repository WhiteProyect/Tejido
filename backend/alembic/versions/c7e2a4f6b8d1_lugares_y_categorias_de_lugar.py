"""lugares y categorias de lugar

Revision ID: c7e2a4f6b8d1
Revises: b8e1f3a5c7d9
Create Date: 2026-11-05 18:00:00.000000

- place_categories: categorias de lugar administrables (slug unico, etiqueta, icono y color de conjuntos
  cerrados con CHECK, orden, activa). Se siembran las 7 iniciales: restaurantes, hoteles, miradores,
  parques, canchas-libres, puestos-gastronomicos, sitios-culturales.
- places: detalle de una publicacion LUGAR (publication_id unico, ON DELETE CASCADE), place_category_id
  (FK RESTRICT, NULL solo para los lugares antiguos sin completar), phone, whatsapp, opening_hours y
  website. La direccion es publications.location y el punto, publications.latitude/longitude.
No se rellena nada: los LUGAR existentes quedan como estan y se completan al editarlos.
Reversible: el downgrade borra las dos tablas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e2a4f6b8d1'
down_revision: Union[str, Sequence[str], None] = 'b8e1f3a5c7d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Copias fijas (no se importan de la app: la migracion no debe cambiar si cambia el codigo).
ICONS = ("utensils", "bed", "binoculars", "tree", "ball", "store", "landmark", "pin", "coffee", "waves")
COLORS = ("ocre", "menta", "morado", "amarillo", "crema", "rio", "bosque")
INITIAL = (
    ("restaurantes", "Restaurantes", "utensils", "ocre"),
    ("hoteles", "Hoteles", "bed", "morado"),
    ("miradores", "Miradores", "binoculars", "rio"),
    ("parques", "Parques", "tree", "bosque"),
    ("canchas-libres", "Canchas libres", "ball", "menta"),
    ("puestos-gastronomicos", "Puestos gastronómicos", "store", "amarillo"),
    ("sitios-culturales", "Sitios culturales", "landmark", "crema"),
)


def _closed_set(column: str, values) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def upgrade() -> None:
    categories = op.create_table(
        'place_categories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('slug', sa.String(length=60), nullable=False),
        sa.Column('label', sa.String(length=60), nullable=False),
        sa.Column('icon', sa.String(length=20), nullable=False),
        sa.Column('color', sa.String(length=12), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(_closed_set('icon', ICONS), name='ck_place_categories_icon'),
        sa.CheckConstraint(_closed_set('color', COLORS), name='ck_place_categories_color'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )
    op.bulk_insert(categories, [{"slug": slug, "label": label, "icon": icon, "color": color, "sort_order": index}
                                for index, (slug, label, icon, color) in enumerate(INITIAL)])

    op.create_table(
        'places',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('publication_id', sa.Integer(), nullable=False),
        sa.Column('place_category_id', sa.Integer(), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('whatsapp', sa.String(length=30), nullable=True),
        sa.Column('opening_hours', sa.String(length=200), nullable=True),
        sa.Column('website', sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(['publication_id'], ['publications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['place_category_id'], ['place_categories.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('publication_id'),
    )
    op.create_index('ix_places_place_category_id', 'places', ['place_category_id'])


def downgrade() -> None:
    op.drop_index('ix_places_place_category_id', table_name='places')
    op.drop_table('places')
    op.drop_table('place_categories')
