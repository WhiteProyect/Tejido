"""Registro publico de ciudadanos: crean su cuenta y entran directo (sin invitacion), con el correo
sin verificar hasta abrir el enlace que les llega (services/email_tokens.py)."""
import secrets
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.core.security import hash_password
from backend.service.errors import AppError
from backend.service.models.tables import Role, Session_ as SessionRow, User
from backend.service.schemas.users import TERMS_VERSION, SignupInput, full_name
from backend.service.services.auth import now_utc, user_payload
from backend.service.services.email_tokens import create_token
from backend.service.services.invites import SESSION_HOURS, validate_new_password


def signup_user(db: Session, payload: SignupInput):
    """Crea un CIUDADANO activo (sin verificar, con la aceptacion de los terminos) y abre sesion.
    Devuelve (session_token, user, verify_token); user tiene el mismo shape que login. El correo
    de verificacion lo envia la ruta en segundo plano con verify_token."""
    if db.execute(select(User.id).where(func.lower(User.email) == payload.email)).first():
        raise AppError(409, "EMAIL_TAKEN", "Ese correo ya tiene una cuenta")
    password = validate_new_password(payload.password)

    role_id = db.execute(select(Role.id).where(Role.name == "CIUDADANO")).scalar_one()
    now = now_utc()
    user = User(
        role_id=role_id, name=full_name(payload.first_name, payload.last_name), email=payload.email,
        password_hash=hash_password(password), active=True, created_at=now,
        first_name=payload.first_name, last_name=payload.last_name, municipality=payload.municipality,
        email_verified_at=None, terms_accepted_at=now, terms_version=TERMS_VERSION,
    )
    db.add(user)
    db.flush()

    session_token = secrets.token_urlsafe(32)
    db.add(SessionRow(token=session_token, user_id=user.id, expires_at=now + timedelta(hours=SESSION_HOURS)))
    verify_token = create_token(db, user.id, "VERIFY")
    db.flush()
    return session_token, user_payload(user, "CIUDADANO"), verify_token
