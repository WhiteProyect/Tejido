from datetime import datetime, timezone
from typing import Iterable, Optional

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.models.tables import Role, User
from backend.service.models.tables import Session_ as SessionRow


def now_utc():
    return datetime.now(timezone.utc)


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[dict]:
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    if not token:
        return None
    row = (
        db.execute(
            select(User.id, User.name, User.email, Role.name.label("role"))
            .join(Role, Role.id == User.role_id)
            .join(SessionRow, SessionRow.user_id == User.id)
            .where(
                SessionRow.token == token,
                SessionRow.expires_at > now_utc(),
                User.active.is_(True),
            )
        )
        .mappings()
        .first()
    )
    return dict(row) if row else None


def require_login(user: Optional[dict], message: str = "Inicia sesion") -> dict:
    if not user:
        raise AppError(401, "UNAUTHORIZED", message)
    return user


def require_roles(user: Optional[dict], roles: Iterable[str], message: str = "Acceso denegado") -> dict:
    if not user or user["role"] not in roles:
        raise AppError(403, "FORBIDDEN", message)
    return user
