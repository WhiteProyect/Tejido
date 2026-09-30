"""Invitaciones de cuenta: un admin crea el usuario y este define su propia contrasena.

El flujo nunca envia correos por su cuenta (eso es services/email.py, llamado desde
el endpoint), asi el seed puede crear tokens sin mandar nada.
"""
import secrets
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.service.core.config import settings
from backend.service.core.security import hash_password
from backend.service.errors import AppError
from backend.service.models.tables import InviteToken, Role, Session_ as SessionRow, User
from backend.service.services.auth import now_utc

INVITE_DAYS = 7
MIN_PASSWORD_LENGTH = 8
SESSION_HOURS = 8  # igual que services/auth.py::login_user


def invite_link(token: str) -> str:
    return f"{settings.frontend_base_url.rstrip('/')}/#invitacion/{token}"


def unusable_password_hash() -> str:
    """Hash de una contrasena aleatoria que nadie conoce: la cuenta no puede loguearse
    hasta aceptar la invitacion (ademas queda active=False)."""
    return hash_password(secrets.token_urlsafe(32))


def create_invite(db: Session, user_id: int, days: int = INVITE_DAYS) -> str:
    """Borra los tokens no usados previos del usuario y crea uno nuevo."""
    db.execute(delete(InviteToken).where(InviteToken.user_id == user_id, InviteToken.used_at.is_(None)))
    token = secrets.token_urlsafe(32)
    now = now_utc()
    db.add(InviteToken(user_id=user_id, token=token, expires_at=now + timedelta(days=days), created_at=now))
    db.flush()
    return token


def validate_new_password(password: str) -> str:
    password = str(password or "")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AppError(400, "WEAK_PASSWORD", f"La contrasena debe tener al menos {MIN_PASSWORD_LENGTH} caracteres")
    return password


def accept_invite(db: Session, token: str, password: str):
    """Define la contrasena, activa la cuenta y abre sesion. Devuelve (session_token, user)
    con el mismo shape que services/auth.py::login_user."""
    invalid = AppError(400, "INVALID_TOKEN", "El enlace de invitación no es válido o expiró")
    invite = db.execute(select(InviteToken).where(InviteToken.token == str(token or ""))).scalar_one_or_none()
    now = now_utc()
    if invite is None or invite.used_at is not None or invite.expires_at <= now:
        raise invalid
    password = validate_new_password(password)

    user, role = db.execute(
        select(User, Role.name).join(Role, Role.id == User.role_id).where(User.id == invite.user_id)
    ).one()
    user.password_hash = hash_password(password)
    user.active = True
    invite.used_at = now

    session_token = secrets.token_urlsafe(32)
    db.add(SessionRow(token=session_token, user_id=user.id, expires_at=now + timedelta(hours=SESSION_HOURS)))
    db.flush()
    return session_token, {"id": user.id, "name": user.name, "email": user.email, "role": role}
