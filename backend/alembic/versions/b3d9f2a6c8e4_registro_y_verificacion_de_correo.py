"""registro y verificacion de correo

Revision ID: b3d9f2a6c8e4
Revises: a7c3e9f1b5d2
Create Date: 2026-10-28 12:00:00.000000

- users: first_name, last_name, municipality, email_verified_at, terms_accepted_at y
  terms_version (todas nullable). Las cuentas existentes quedan verificadas de oficio
  (email_verified_at = created_at): nadie que ya usaba TEJIDO pierde funciones.
- email_tokens: enlaces de un solo uso para verificar el correo y restablecer la contrasena
  (solo el sha256 del token).
Reversible: el downgrade borra la tabla y las columnas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d9f2a6c8e4'
down_revision: Union[str, Sequence[str], None] = 'a7c3e9f1b5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

USER_COLUMNS = [
    sa.Column('first_name', sa.String(), nullable=True),
    sa.Column('last_name', sa.String(), nullable=True),
    sa.Column('municipality', sa.String(), nullable=True),
    sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('terms_version', sa.String(), nullable=True),
]


def upgrade() -> None:
    """Upgrade schema."""
    for column in USER_COLUMNS:
        op.add_column('users', column)
    op.execute("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL")

    op.create_table(
        'email_tokens',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('purpose', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_email_tokens_token_hash', 'email_tokens', ['token_hash'], unique=True)
    op.create_index('ix_email_tokens_user_id', 'email_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_email_tokens_user_id', table_name='email_tokens')
    op.drop_index('ix_email_tokens_token_hash', table_name='email_tokens')
    op.drop_table('email_tokens')
    for column in reversed(USER_COLUMNS):
        op.drop_column('users', column.name)
