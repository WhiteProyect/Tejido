import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from backend.service.core.security import verify_password
from backend.service.models.tables import Role, Session_ as SessionRow, User


def now_utc():
    return datetime.now(timezone.utc)


def login_user(db: Session, email: str, password: str):
    email = str(email or "").strip().lower()
    row = (
        db.execute(
            select(User, Role.name.label("role"))
            .join(Role, Role.id == User.role_id)
            .where(func.lower(User.email) == email, User.active.is_(True))
        )
        .first()
    )
    if not row:
        return None
    user, role = row
    if not verify_password(password, user.password_hash):
        return None

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    db.add(SessionRow(token=token, user_id=user.id, expires_at=expires_at))
    db.flush()
    return token, {"id": user.id, "name": user.name, "email": user.email, "role": role}


def logout_user(db: Session, token: str):
    if not token:
        return
    db.execute(delete(SessionRow).where(SessionRow.token == token))
