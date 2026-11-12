"""carrusel del inicio elegido por el admin

Tabla home_carousel_picks: elecciones del admin (una publicacion, un talento o un artista por fila, con
FK ON DELETE CASCADE, cada elemento una sola vez) en orden dentro de su lista. Tabla home_carousel_settings
de una sola fila (id = 1) con las cantidades: contenido 10, Moneystack 3, TEJIDO 3; se crea con los
valores por defecto. No toca publications.featured, talent_profiles.featured ni artists.featured.

Revision ID: a7c9e1b3d5f8
Revises: f6b8d0a2c4e7
Create Date: 2026-11-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c9e1b3d5f8'
down_revision: Union[str, Sequence[str], None] = 'f6b8d0a2c4e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'home_carousel_picks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('publication_id', sa.Integer(), nullable=True),
        sa.Column('talent_id', sa.Integer(), nullable=True),
        sa.Column('artist_id', sa.Integer(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('num_nonnulls(publication_id, talent_id, artist_id) = 1', name='ck_home_carousel_picks_one_item'),
        sa.ForeignKeyConstraint(['publication_id'], ['publications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['talent_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('uq_home_carousel_picks_publication', 'home_carousel_picks', ['publication_id'], unique=True,
                    postgresql_where=sa.text('publication_id IS NOT NULL'))
    op.create_index('uq_home_carousel_picks_talent', 'home_carousel_picks', ['talent_id'], unique=True,
                    postgresql_where=sa.text('talent_id IS NOT NULL'))
    op.create_index('uq_home_carousel_picks_artist', 'home_carousel_picks', ['artist_id'], unique=True,
                    postgresql_where=sa.text('artist_id IS NOT NULL'))

    settings = op.create_table(
        'home_carousel_settings',
        sa.Column('id', sa.Integer(), autoincrement=False, nullable=False),
        sa.Column('content_limit', sa.Integer(), server_default=sa.text('10'), nullable=False),
        sa.Column('moneystack_limit', sa.Integer(), server_default=sa.text('3'), nullable=False),
        sa.Column('tejido_limit', sa.Integer(), server_default=sa.text('3'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('id = 1', name='ck_home_carousel_settings_single_row'),
        sa.CheckConstraint('content_limit BETWEEN 0 AND 12', name='ck_home_carousel_settings_content'),
        sa.CheckConstraint('moneystack_limit BETWEEN 0 AND 6', name='ck_home_carousel_settings_moneystack'),
        sa.CheckConstraint('tejido_limit BETWEEN 0 AND 6', name='ck_home_carousel_settings_tejido'),
        sa.CheckConstraint('content_limit + moneystack_limit + tejido_limit > 0', name='ck_home_carousel_settings_total'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.bulk_insert(settings, [{'id': 1}])


def downgrade() -> None:
    op.drop_table('home_carousel_settings')
    op.drop_index('uq_home_carousel_picks_artist', table_name='home_carousel_picks')
    op.drop_index('uq_home_carousel_picks_talent', table_name='home_carousel_picks')
    op.drop_index('uq_home_carousel_picks_publication', table_name='home_carousel_picks')
    op.drop_table('home_carousel_picks')
