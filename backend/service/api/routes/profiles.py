"""Edicion del perfil publico propio del gestor (services/org_profiles.py).

Solo GESTOR, y siempre sobre la organizacion del usuario de la sesion: el body nunca elige
organizacion. GET/PATCH /api/me/organization (routes/auth.py) siguen igual por compatibilidad.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.schemas.org_profiles import GalleryInput, HighlightInput, ProfileUpdateInput, SocialLinksInput
from backend.service.services import org_profiles as svc

router = APIRouter(prefix="/api/me/profile")

GESTOR_ONLY = "Solo un gestor tiene un perfil público"


def _gestor(user: Optional[dict]) -> dict:
    return require_roles(user, ("GESTOR",), GESTOR_ONLY)


@router.get("")
def get_my_profile(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.own_profile(db, _gestor(user)["id"])


@router.get("/preview")
def preview_my_profile(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lo mismo que GET /api/gestores/{slug} (solo lo publico), aunque este oculto, con profile_hidden."""
    return svc.preview_profile(db, _gestor(user)["id"])


@router.patch("")
def patch_my_profile(payload: ProfileUpdateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.update_profile(db, _gestor(user)["id"], payload)


@router.put("/social-links")
def put_social_links(payload: SocialLinksInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.replace_social_links(db, _gestor(user)["id"], payload.links)


@router.put("/gallery")
def put_gallery(payload: GalleryInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.replace_gallery(db, _gestor(user)["id"], payload.images)


@router.post("/highlights", status_code=201)
def post_highlight(payload: HighlightInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.create_highlight(db, _gestor(user)["id"], payload)


@router.patch("/highlights/{highlight_id}")
def patch_highlight(highlight_id: int, payload: HighlightInput, user: Optional[dict] = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    return svc.update_highlight(db, _gestor(user)["id"], highlight_id, payload)


@router.delete("/highlights/{highlight_id}")
def delete_highlight(highlight_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.delete_highlight(db, _gestor(user)["id"], highlight_id)
    return {"ok": True}
