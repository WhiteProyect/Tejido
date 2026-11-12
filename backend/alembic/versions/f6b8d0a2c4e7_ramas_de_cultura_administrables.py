"""ramas de cultura administrables

Tabla cultural_branches (clave inmutable, etiqueta unica, slug, orden, activa, protegida, imagen). Siembra
las 10 ramas que hasta ahora vivian en codigo (mismas claves, etiquetas y orden), marca MUSICA como
protegida y copia las portadas de cultural_category_covers. NO borra cultural_category_covers: queda sin uso
hasta una migracion posterior. No toca organizaciones, publicaciones, talento ni solicitudes (siguen
guardando la clave).

Revision ID: f6b8d0a2c4e7
Revises: e4a6c8b0d2f5
Create Date: 2026-11-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6b8d0a2c4e7'
down_revision: Union[str, Sequence[str], None] = 'e4a6c8b0d2f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Copia congelada de la lista que vivia en schemas/cultural_categories.py (clave, etiqueta), en su orden.
BRANCHES = (
    ('MUSICA', 'Música'), ('CINE_AUDIOVISUAL', 'Cine y audiovisual'), ('DANZA', 'Danza'), ('TEATRO', 'Teatro'),
    ('ARTES_VISUALES', 'Artes visuales'), ('LITERATURA', 'Literatura'), ('ARTESANIAS', 'Artesanías'),
    ('PATRIMONIO_MEMORIA', 'Patrimonio y memoria'), ('GASTRONOMIA_CULTURAL', 'Gastronomía cultural'),
    ('EMPRENDIMIENTO_CULTURAL', 'Emprendimiento cultural'),
)


def upgrade() -> None:
    op.create_table(
        'cultural_branches',
        sa.Column('key', sa.String(length=40), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('protected', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("key ~ '^[A-Z][A-Z0-9_]{0,39}$'", name='ck_cultural_branches_key'),
        sa.PrimaryKeyConstraint('key'),
        sa.UniqueConstraint('slug'),
    )
    op.create_index('uq_cultural_branches_label_lower', 'cultural_branches', [sa.text('lower(label)')], unique=True)
    branches = sa.table('cultural_branches', sa.column('key', sa.String), sa.column('label', sa.String), sa.column('slug', sa.String),
                        sa.column('position', sa.Integer), sa.column('protected', sa.Boolean))
    op.bulk_insert(branches, [
        {'key': key, 'label': label, 'slug': key.lower().replace('_', '-'), 'position': position, 'protected': key == 'MUSICA'}
        for position, (key, label) in enumerate(BRANCHES)
    ])
    # Portadas ya guardadas: pasan a la rama.
    op.execute("UPDATE cultural_branches b SET image_url = c.image_url FROM cultural_category_covers c WHERE c.category_key = b.key")


def downgrade() -> None:
    op.drop_index('uq_cultural_branches_label_lower', table_name='cultural_branches')
    op.drop_table('cultural_branches')
