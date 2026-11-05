"""tipos y detalle de oportunidades

Revision ID: f3c1a9e7b5d2
Revises: e8b3c5d7f9a2
Create Date: 2026-11-04 12:00:00.000000

- opportunity_types: tipos administrables (slug unico, etiqueta, orden, activo). Se siembran los 5
  iniciales: convocatoria, taller, audicion, concurso, curso.
- opportunities: type_id (FK RESTRICT), organizer (quien convoca, 120), requirements (lista JSON),
  prize (120) y audience (160). organization_name se conserva (legado, ya no se escribe) y su valor
  se copia a organizer donde exista. Las demas filas quedan sin tipo ni campos nuevos.
- opportunity_reminders: avisos de cierre enviados, unicos por (usuario, publicacion, dias antes).
Reversible: el downgrade borra lo agregado (organization_name sigue intacta).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f3c1a9e7b5d2'
down_revision: Union[str, Sequence[str], None] = 'e8b3c5d7f9a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INITIAL_TYPES = [
    ("convocatoria", "Convocatoria"), ("taller", "Taller"), ("audicion", "Audición"),
    ("concurso", "Concurso"), ("curso", "Curso"),
]


def upgrade() -> None:
    types = op.create_table(
        'opportunity_types',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('slug', sa.String(length=60), nullable=False),
        sa.Column('label', sa.String(length=60), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )
    op.bulk_insert(types, [{"slug": slug, "label": label, "sort_order": index} for index, (slug, label) in enumerate(INITIAL_TYPES)])

    op.add_column('opportunities', sa.Column('type_id', sa.Integer(), nullable=True))
    op.add_column('opportunities', sa.Column('organizer', sa.String(length=120), nullable=True))
    op.add_column('opportunities', sa.Column('requirements', postgresql.JSONB(astext_type=sa.Text()),
                                             server_default=sa.text("'[]'::jsonb"), nullable=False))
    op.add_column('opportunities', sa.Column('prize', sa.String(length=120), nullable=True))
    op.add_column('opportunities', sa.Column('audience', sa.String(length=160), nullable=True))
    op.create_foreign_key('opportunities_type_id_fkey', 'opportunities', 'opportunity_types', ['type_id'], ['id'], ondelete='RESTRICT')
    op.create_index('ix_opportunities_type_id', 'opportunities', ['type_id'])
    op.execute("UPDATE opportunities SET organizer = left(btrim(organization_name), 120) "
               "WHERE organizer IS NULL AND btrim(coalesce(organization_name, '')) <> ''")

    op.create_table(
        'opportunity_reminders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('publication_id', sa.Integer(), nullable=False),
        sa.Column('days_before', sa.Integer(), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['publication_id'], ['publications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'publication_id', 'days_before', name='uq_opportunity_reminder'),
    )


def downgrade() -> None:
    op.drop_table('opportunity_reminders')
    op.drop_index('ix_opportunities_type_id', table_name='opportunities')
    op.drop_constraint('opportunities_type_id_fkey', 'opportunities', type_='foreignkey')
    op.drop_column('opportunities', 'audience')
    op.drop_column('opportunities', 'prize')
    op.drop_column('opportunities', 'requirements')
    op.drop_column('opportunities', 'organizer')
    op.drop_column('opportunities', 'type_id')
    op.drop_table('opportunity_types')
