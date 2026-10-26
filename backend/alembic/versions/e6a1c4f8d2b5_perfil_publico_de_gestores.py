"""perfil publico de gestores

Revision ID: e6a1c4f8d2b5
Revises: d4e9b2c7f1a3
Create Date: 2026-10-25 12:00:00.000000

- organizations: slug (relleno desde name, colisiones con -2, -3...; luego NOT NULL e indice
  unico sobre lower(slug)) y los campos del perfil publico (lema, portada, año de fundacion,
  municipio, sede, contacto publico con sus show_* en false, buscamos, reconocimientos,
  profile_hidden).
- organization_social_links, organization_highlights y organization_images.
"""
import re
import unicodedata
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6a1c4f8d2b5'
down_revision: Union[str, Sequence[str], None] = 'd4e9b2c7f1a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MAX_SLUG_LENGTH = 80


def _slugify(text: str) -> str:
    # Copia congelada de services/artists.py::slugify (una migracion no importa codigo vivo).
    ascii_text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:MAX_SLUG_LENGTH].strip("-") or "gestor"


def upgrade() -> None:
    """Upgrade schema."""
    false = sa.text('false')
    columns = [
        sa.Column('slug', sa.String(), nullable=True),
        sa.Column('tagline', sa.String(), nullable=True),
        sa.Column('cover_url', sa.String(), nullable=True),
        sa.Column('founded_year', sa.Integer(), nullable=True),
        sa.Column('municipality', sa.String(), nullable=True),
        sa.Column('has_venue', sa.Boolean(), server_default=false, nullable=False),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('opening_hours', sa.String(), nullable=True),
        sa.Column('map_url', sa.String(), nullable=True),
        sa.Column('whatsapp', sa.String(), nullable=True),
        sa.Column('public_email', sa.String(), nullable=True),
        sa.Column('website', sa.String(), nullable=True),
        sa.Column('show_whatsapp', sa.Boolean(), server_default=false, nullable=False),
        sa.Column('show_public_email', sa.Boolean(), server_default=false, nullable=False),
        sa.Column('show_website', sa.Boolean(), server_default=false, nullable=False),
        sa.Column('seeking_text', sa.String(), nullable=True),
        sa.Column('achievements', sa.Text(), nullable=True),
        sa.Column('profile_hidden', sa.Boolean(), server_default=false, nullable=False),
    ]
    for column in columns:
        op.add_column('organizations', column)

    # Relleno de slugs de las organizaciones existentes, en orden de id.
    conn = op.get_bind()
    taken = set()
    for org_id, name in conn.execute(sa.text("SELECT id, name FROM organizations ORDER BY id")).all():
        base = _slugify(name)
        if base.isdigit():
            base = f"gestor-{base}"
        candidate, n = base, 2
        while candidate in taken:
            suffix = f"-{n}"
            candidate = base[:MAX_SLUG_LENGTH - len(suffix)].strip("-") + suffix
            n += 1
        taken.add(candidate)
        conn.execute(sa.text("UPDATE organizations SET slug = :slug WHERE id = :id"), {"slug": candidate, "id": org_id})

    op.alter_column('organizations', 'slug', nullable=False)
    op.create_index('uq_organizations_slug_lower', 'organizations', [sa.text('lower(slug)')], unique=True)

    op.create_table(
        'organization_social_links',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('platform', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_organization_social_links_organization_id', 'organization_social_links', ['organization_id'])
    op.create_table(
        'organization_highlights',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('when_text', sa.String(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_organization_highlights_organization_id', 'organization_highlights', ['organization_id'])
    op.create_table(
        'organization_images',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('highlight_id', sa.Integer(), nullable=True),
        sa.Column('url', sa.String(), nullable=False),
        sa.Column('alt_text', sa.String(), nullable=True),
        sa.Column('caption', sa.String(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['highlight_id'], ['organization_highlights.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_organization_images_organization_id', 'organization_images', ['organization_id'])
    op.create_index('ix_organization_images_highlight_id', 'organization_images', ['highlight_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('organization_images')
    op.drop_table('organization_highlights')
    op.drop_table('organization_social_links')
    op.drop_index('uq_organizations_slug_lower', table_name='organizations')
    for name in ('profile_hidden', 'achievements', 'seeking_text', 'show_website', 'show_public_email', 'show_whatsapp',
                 'website', 'public_email', 'whatsapp', 'map_url', 'opening_hours', 'address', 'has_venue',
                 'municipality', 'founded_year', 'cover_url', 'tagline', 'slug'):
        op.drop_column('organizations', name)
