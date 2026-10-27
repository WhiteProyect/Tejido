"""GET /api/me/saved: lo que guardo el ciudadano (publicaciones y talento) y sigue publicado.

Solo CIUDADANO (gestores y admins no guardan). Lo despublicado o borrado simplemente no aparece.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user
from backend.service.db.session import get_db
from backend.service.services import publications as publications_service
from backend.service.services import talent as talent_service

router = APIRouter()


@router.get("/api/me/saved")
def my_saved(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    user = talent_service.require_citizen(user)
    return {
        "publications": publications_service.saved_publications(db, user["id"]),
        "talent": talent_service.saved_cards(db, user),
    }
