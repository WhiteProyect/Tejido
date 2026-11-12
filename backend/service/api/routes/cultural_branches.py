"""Ramas de cultura: lista publica (las activas) y CRUD del admin (services/cultural_branches.py)."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.service.api.caching import revalidated_json
from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.schemas.fields import our_cloudinary_image
from backend.service.services import cultural_branches as svc

router = APIRouter()
ADMIN_ONLY = "Acceso administrativo requerido"


@router.get("/api/cultural-branches")
def public_branches(request: Request, db: Session = Depends(get_db)):
    """Publico: ramas activas por orden, con key, label, slug e image_url (ETag: un cambio se ve en la siguiente carga)."""
    return revalidated_json(request, [svc.public_dict(branch) for branch in svc.list_branches(db, active_only=True)])


def _image(v):
    v = str(v or "").strip()
    return our_cloudinary_image(v, "tejido/categorias") if v else None


class BranchCreateInput(BaseModel):
    label: str = ""
    image_url: Optional[str] = None

    @field_validator("image_url", mode="before")
    @classmethod
    def _image_url(cls, v):
        return _image(v)


class BranchUpdateInput(BaseModel):
    label: Optional[str] = None
    image_url: Optional[str] = None
    active: Optional[bool] = None

    @field_validator("image_url", mode="before")
    @classmethod
    def _image_url(cls, v):
        return _image(v)


class BranchMoveInput(BaseModel):
    direction: Literal["up", "down"]


@router.get("/api/admin/cultural-branches")
def admin_branches(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Todas (tambien las desactivadas) con conteos, lider y si se pueden desactivar o borrar (y por que no)."""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    return svc.admin_list(db)


@router.post("/api/admin/cultural-branches", status_code=201)
def create_branch(payload: BranchCreateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    branch = svc.create_branch(db, payload.label, payload.image_url)
    db.commit()
    return svc.admin_detail(db, branch.key)


@router.patch("/api/admin/cultural-branches/{key}")
def update_branch(key: str, payload: BranchUpdateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Nombre, imagen y activa/desactivada. La clave y el slug no cambian nunca."""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    fields = {name: getattr(payload, name) for name in payload.model_fields_set}
    branch = svc.update_branch(db, key, fields)
    db.commit()
    return svc.admin_detail(db, branch.key)


@router.post("/api/admin/cultural-branches/{key}/move")
def move_branch(key: str, payload: BranchMoveInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    svc.move_branch(db, key, payload.direction)
    db.commit()
    return svc.admin_list(db)


@router.delete("/api/admin/cultural-branches/{key}")
def delete_branch(key: str, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    svc.delete_branch(db, key)
    db.commit()
    return {"ok": True}
