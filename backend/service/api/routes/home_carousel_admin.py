"""Carrusel del inicio elegido por el admin (services/home_carousel_admin.py). Solo ADMIN (403 a los demas)."""
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Response
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.services import home_carousel_admin as svc

router = APIRouter(prefix="/api/admin/home-carousel")
ADMIN_ONLY = "Acceso administrativo requerido"


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


@router.get("")
def get_carousel(response: Response, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Cantidades, las dos listas elegidas (con estado y motivo) y la vista previa con el builder publico."""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    _private(response)
    return svc.overview(db)


@router.put("")
def put_carousel(response: Response, payload: Any = Body(default=None), user: Optional[dict] = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """{settings: {content_limit, moneystack_limit, tejido_limit}, content: [{type, id}], artists: [{type: ARTIST, id}]}"""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    svc.save(db, payload)
    db.commit()
    _private(response)
    return svc.overview(db)


@router.delete("")
def reset_carousel(response: Response, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Volver a automatico: vacia los elegidos y restablece 10 / 3 / 3."""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    svc.reset(db)
    db.commit()
    _private(response)
    return svc.overview(db)


@router.get("/candidates")
def get_candidates(response: Response, section: str = "content", kind: Optional[str] = None, category: Optional[str] = None,
                   sello: Optional[str] = None, q: Optional[str] = None, offset: Optional[str] = None,
                   user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    _private(response)
    return svc.candidates(db, section, kind=kind, category=category, sello=sello, q=q, offset=offset)
