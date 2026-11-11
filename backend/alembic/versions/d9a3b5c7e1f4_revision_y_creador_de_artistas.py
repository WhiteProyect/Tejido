"""revision y creador de artistas

Revision ID: d9a3b5c7e1f4
Revises: c7e2a4f6b8d1
Create Date: 2026-11-09 12:00:00.000000

- artists.status (String(12), NOT NULL, por defecto 'PUBLISHED') con CHECK ck_artists_status en
  ('PUBLISHED', 'REVIEW', 'REJECTED'): lo que crea el lider de la rama Musica llega en REVIEW.
- artists.review_note (Text, NULL): motivo del rechazo que ve el lider.
- artists.created_by_user_id (FK users, NULL, ON DELETE SET NULL): quien lo cargo.
Los artistas existentes quedan PUBLISHED (por el valor por defecto) y conservan su moneystack: sin
cambio de comportamiento.
Reversible: el downgrade borra la FK, el CHECK y las tres columnas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9a3b5c7e1f4'
down_revision: Union[str, Sequence[str], None] = 'c7e2a4f6b8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('artists', sa.Column('status', sa.String(length=12), server_default=sa.text("'PUBLISHED'"), nullable=False))
    op.add_column('artists', sa.Column('review_note', sa.Text(), nullable=True))
    op.add_column('artists', sa.Column('created_by_user_id', sa.Integer(), nullable=True))
    op.create_check_constraint('ck_artists_status', 'artists', "status IN ('PUBLISHED', 'REVIEW', 'REJECTED')")
    op.create_foreign_key('artists_created_by_user_id_fkey', 'artists', 'users', ['created_by_user_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('artists_created_by_user_id_fkey', 'artists', type_='foreignkey')
    op.drop_constraint('ck_artists_status', 'artists', type_='check')
    op.drop_column('artists', 'created_by_user_id')
    op.drop_column('artists', 'review_note')
    op.drop_column('artists', 'status')
