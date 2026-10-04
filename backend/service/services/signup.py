"""Registro publico de ciudadanos: crean su cuenta y entran directo (sin invitacion)."""
import secrets
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.core.security import hash_password
from backend.service.errors import AppError
from backend.service.models.tables import Role, Session_ as SessionRow, User
from backend.service.services.auth import now_utc
from backend.service.services.invites import SESSION_HOURS, validate_new_password


def signup_user(db: Session, name: str, email: str, password: str):
    """Crea un CIUDADANO activo y abre sesion. Devuelve (session_token, user) con el
    mismo shape que services/auth.py::login_user."""
    if db.execute(select(User.id).where(func.lower(User.email) == email)).first():
        raise AppError(409, "EMAIL_TAKEN", "Ese correo ya tiene una cuenta")
    password = validate_new_password(password)

    role_id = db.execute(select(Role.id).where(Role.name == "CIUDADANO")).scalar_one()
    now = now_utc()
    user = User(role_id=role_id, name=name, email=email, password_hash=hash_password(password),
                active=True, created_at=now)
    db.add(user)
    db.flush()

    session_token = secrets.token_urlsafe(32)
    db.add(SessionRow(token=session_token, user_id=user.id, expires_at=now + timedelta(hours=SESSION_HOURS)))
    db.flush()
    return session_token, {"id": user.id, "name": user.name, "email": user.email, "role": "CIUDADANO",
                           "avatar_url": user.avatar_url}
