"""talento contratable

Revision ID: f2b8d5a9c3e7
Revises: e6a1c4f8d2b5
Create Date: 2026-10-26 12:00:00.000000

Solo crea tablas nuevas (no toca las existentes):
- talent_profiles: portafolio de contratacion artistica (slug unico sobre lower(slug), estado
  editorial, sello verificado con CHECK de acta, borrado suave).
- talent_services, talent_specs, talent_availability, talent_media, talent_milestones y
  talent_endorsements (hijas con ON DELETE CASCADE).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2b8d5a9c3e7'
down_revision: Union[str, Sequence[str], None] = 'e6a1c4f8d2b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _child(name: str, *columns: sa.Column, constraints=()) -> None:
    op.create_table(
        name,
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('talent_id', sa.Integer(), nullable=False),
        *columns,
        sa.ForeignKeyConstraint(['talent_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        *constraints,
    )
    op.create_index(f'ix_{name}_talent_id', name, ['talent_id'], unique=False)


def upgrade() -> None:
    """Upgrade schema."""
    false = sa.text('false')
    op.create_table(
        'talent_profiles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('origin', sa.String(), nullable=False),
        sa.Column('tagline', sa.String(length=200), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_url', sa.String(), nullable=True),
        sa.Column('representative_user_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), server_default=sa.text("'DRAFT'"), nullable=False),
        sa.Column('moderation_note', sa.Text(), nullable=True),
        sa.Column('verified', sa.Boolean(), server_default=false, nullable=False),
        sa.Column('act_number', sa.String(length=30), nullable=True),
        sa.Column('act_date', sa.Date(), nullable=True),
        sa.Column('featured', sa.Boolean(), server_default=false, nullable=False),
        sa.Column('deleted', sa.Boolean(), server_default=false, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('verified = false OR act_number IS NOT NULL', name='ck_talent_profiles_verified_has_act'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['representative_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('uq_talent_profiles_slug_lower', 'talent_profiles', [sa.text('lower(slug)')], unique=True)
    op.create_index('ix_talent_profiles_status_deleted', 'talent_profiles', ['status', 'deleted'], unique=False)
    op.create_index('ix_talent_profiles_category', 'talent_profiles', ['category'], unique=False)
    op.create_index('ix_talent_profiles_origin', 'talent_profiles', ['origin'], unique=False)
    op.create_index('ix_talent_profiles_representative_user_id', 'talent_profiles', ['representative_user_id'], unique=False)

    position = lambda: sa.Column('position', sa.Integer(), nullable=False)  # noqa: E731
    _child('talent_services', position(),
           sa.Column('title', sa.String(length=100), nullable=False),
           sa.Column('tag', sa.String(length=20), nullable=True),
           sa.Column('description', sa.String(length=300), nullable=True),
           sa.Column('price', sa.Integer(), nullable=True),
           sa.Column('price_note', sa.String(length=60), nullable=True))
    _child('talent_specs', position(),
           sa.Column('label', sa.String(length=60), nullable=False),
           sa.Column('value', sa.String(length=200), nullable=False))
    _child('talent_availability',
           sa.Column('day', sa.Date(), nullable=False),
           sa.Column('state', sa.String(), nullable=False),
           constraints=(sa.UniqueConstraint('talent_id', 'day', name='uq_talent_availability_day'),))
    _child('talent_media', position(),
           sa.Column('type', sa.String(), nullable=False),
           sa.Column('url', sa.String(), nullable=False),
           sa.Column('thumbnail_url', sa.String(), nullable=True),
           sa.Column('title', sa.String(length=100), nullable=True),
           sa.Column('caption', sa.String(length=150), nullable=True))
    _child('talent_milestones', position(),
           sa.Column('year', sa.Integer(), nullable=False),
           sa.Column('title', sa.String(length=100), nullable=False),
           sa.Column('description', sa.String(length=400), nullable=True))
    _child('talent_endorsements', position(),
           sa.Column('kind', sa.String(), nullable=False),
           sa.Column('title', sa.String(length=100), nullable=False),
           sa.Column('text', sa.String(length=400), nullable=True),
           sa.Column('rating', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    for name in ('talent_endorsements', 'talent_milestones', 'talent_media', 'talent_availability', 'talent_specs', 'talent_services'):
        op.drop_index(f'ix_{name}_talent_id', table_name=name)
        op.drop_table(name)
    for index in ('ix_talent_profiles_representative_user_id', 'ix_talent_profiles_origin', 'ix_talent_profiles_category',
                  'ix_talent_profiles_status_deleted', 'uq_talent_profiles_slug_lower'):
        op.drop_index(index, table_name='talent_profiles')
    op.drop_table('talent_profiles')
