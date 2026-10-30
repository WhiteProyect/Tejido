"""Enlaces de un solo uso por correo: verificar el correo (VERIFY, 48 h) y restablecer la
contrasena (RESET, 1 h).

- En la base solo se guarda el sha256 del token; el token en claro viaja unicamente en el correo.
- Al crear uno nuevo del mismo proposito para un usuario se borran los anteriores sin usar.
- Nunca envian correos: eso lo hacen las rutas en segundo plano (services/notifications.py).
"""
import hashlib
import secrets
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.service.core.config import settings
from backend.service.errors import AppError
from backend.service.models.tables import EmailToken
from backend.service.services.auth import now_utc

LIFETIME = {"VERIFY": timedelta(hours=48), "RESET": timedelta(hours=1)}
ROUTES = {"VERIFY": "verificar", "RESET": "restablecer"}
MESSAGES = {
    "VERIFY": {
        "invalid": "Este enlace de verificación no es válido. Pide uno nuevo desde tu cuenta.",
        "expired": "Este enlace de verificación venció. Pide uno nuevo desde tu cuenta.",
        "used": "Este enlace de verificación ya se usó.",
    },
    "RESET": {
        "invalid": "Este enlace para restablecer la contraseña no es válido. Pide uno nuevo.",
        "expired": "Este enlace para restablecer la contraseña venció (dura 1 hora). Pide uno nuevo.",
        "used": "Este enlace para restablecer la contraseña ya se usó. Pide uno nuevo si lo necesitas.",
    },
}


def hash_token(token: str) -> str:
    return hashlib.sha256(str(token or "").encode()).hexdigest()


def token_link(purpose: str, token: str) -> str:
    """Enlace del correo, con la misma base que las invitaciones y el router por hash."""
    return f"{settings.frontend_base_url.rstrip('/')}/#{ROUTES[purpose]}?token={token}"


def create_token(db: Session, user_id: int, purpose: str) -> str:
    """Crea un token nuevo (borrando los anteriores sin usar del mismo proposito) y devuelve el
    token en claro, que solo debe ir en el correo."""
    db.execute(delete(EmailToken).where(EmailToken.user_id == user_id, EmailToken.purpose == purpose,
                                        EmailToken.used_at.is_(None)))
    token = secrets.token_urlsafe(32)
    now = now_utc()
    db.add(EmailToken(user_id=user_id, purpose=purpose, token_hash=hash_token(token),
                      expires_at=now + LIFETIME[purpose], created_at=now))
    db.flush()
    return token


def find_token(db: Session, token: str, purpose: str) -> tuple[EmailToken, str]:
    """(fila, estado) con estado 'ok' | 'used' | 'expired'. Un token que no existe (o de otro
    proposito) lanza 400 INVALID_TOKEN."""
    row = db.execute(
        select(EmailToken).where(EmailToken.token_hash == hash_token(token), EmailToken.purpose == purpose)
    ).scalar_one_or_none()
    if row is None:
        raise AppError(400, "INVALID_TOKEN", MESSAGES[purpose]["invalid"])
    if row.used_at is not None:
        return row, "used"
    if row.expires_at <= now_utc():
        return row, "expired"
    return row, "ok"


def token_error(purpose: str, state: str) -> AppError:
    code = {"used": "TOKEN_USED", "expired": "TOKEN_EXPIRED"}[state]
    return AppError(400, code, MESSAGES[purpose][state])
