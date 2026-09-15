from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.models.tables import Publication, Report, Suggestion, User
from backend.service.services.serialization import rows_to_dicts

router = APIRouter(prefix="/api/admin")


@router.get("/stats")
def stats(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), "Acceso administrativo requerido")
    published = db.execute(
        select(func.count()).select_from(Publication).where(Publication.status == "PUBLISHED", Publication.deleted.is_(False))
    ).scalar_one()
    pending = db.execute(
        select(func.count()).select_from(Publication).where(Publication.status == "REVIEW", Publication.deleted.is_(False))
    ).scalar_one()
    users = db.execute(select(func.count()).select_from(User).where(User.active.is_(True))).scalar_one()
    reports = db.execute(select(func.count()).select_from(Report).where(Report.status == "OPEN")).scalar_one()
    suggestions = db.execute(select(func.count()).select_from(Suggestion).where(Suggestion.status == "NEW")).scalar_one()
    return {"published": published, "pending": pending, "users": users, "reports": reports, "suggestions": suggestions}


@router.get("/suggestions")
def list_suggestions(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), "Acceso administrativo requerido")
    rows = db.execute(
        select(Suggestion.id, Suggestion.message, Suggestion.status, Suggestion.created_at,
               User.name.label("user_name"), User.email.label("user_email"))
        .join(User, User.id == Suggestion.user_id, isouter=True)
        .order_by(Suggestion.created_at.desc())
        .limit(50)
    ).all()
    return rows_to_dicts(rows)
