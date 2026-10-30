"""Verificacion de correo y restablecimiento de contrasena (los enlaces viven en
services/email_tokens.py; los correos los envian las rutas en segundo plano)."""
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from backend.service.core.security import hash_password
from backend.service.models.tables import Session_ as SessionRow, User
from backend.service.services.auth import now_utc
from backend.service.services.email_tokens import create_token, find_token, token_error
from backend.service.services.invites import validate_new_password


def verify_email(db: Session, token: str) -> bool:
    """Marca el correo como verificado. Devuelve True si ya lo estaba (enlace repetido o un enlace
    nuevo de alguien ya verificado): verificar es idempotente. Vencido o invalido: 400."""
    row, state = find_token(db, token, "VERIFY")
    user = db.get(User, row.user_id)
    now = now_utc()
    if user.email_verified_at is not None:
        if state == "ok":
            row.used_at = now
            db.flush()
        return True
    if state != "ok":
        raise token_error("VERIFY", state)
    user.email_verified_at = now
    row.used_at = now
    db.flush()
    return False


def start_verification(db: Session, user_id: int) -> tuple[str, str, str] | None:
    """(correo, nombre, token) para reenviar la verificacion, o None si ya esta verificado."""
    user = db.get(User, user_id)
    if user is None or user.email_verified_at is not None:
        return None
    return user.email, user.first_name, create_token(db, user.id, "VERIFY")


def start_password_reset(db: Session, email: str) -> tuple[str, str, str] | None:
    """(correo, nombre, token) si existe una cuenta ACTIVA con ese correo; si no, None (quien llama
    responde lo mismo en ambos casos)."""
    user = db.execute(select(User).where(func.lower(User.email) == email, User.active.is_(True))).scalar_one_or_none()
    if user is None:
        return None
    return user.email, user.first_name or user.name, create_token(db, user.id, "RESET")


def reset_password(db: Session, token: str, password: str) -> None:
    """Cambia la contrasena, cierra TODAS las sesiones del usuario y deja el correo verificado
    (recibir el correo lo prueba). No abre sesion. Token vencido, usado o invalido: 400."""
    row, state = find_token(db, token, "RESET")
    if state != "ok":
        raise token_error("RESET", state)
    password = validate_new_password(password)
    user = db.get(User, row.user_id)
    now = now_utc()
    user.password_hash = hash_password(password)
    if user.email_verified_at is None:
        user.email_verified_at = now
    row.used_at = now
    db.execute(delete(SessionRow).where(SessionRow.user_id == user.id))
    db.flush()
