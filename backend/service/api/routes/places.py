from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.services import place_categories as service

router = APIRouter()
ADMIN_ONLY = "Acceso administrativo requerido"


@router.get("/api/place-categories")
def place_categories(db: Session = Depends(get_db)):
    """Publico: categorias de lugar activas, en su orden (slug, label, icon, color)."""
    return service.public_categories(db)


class CategoryCreateInput(BaseModel):
    label: str = ""
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryUpdateInput(BaseModel):
    label: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None


class CategoryMoveInput(BaseModel):
    direction: str = ""


@router.get("/api/admin/place-categories")
def admin_list(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    return service.admin_categories(db)


@router.post("/api/admin/place-categories", status_code=201)
def admin_create(payload: CategoryCreateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    return service.public_dict(service.create_category(db, payload.label, payload.icon, payload.color))


@router.patch("/api/admin/place-categories/{category_id:int}")
def admin_update(category_id: int, payload: CategoryUpdateInput, user: Optional[dict] = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    if all(value is None for value in (payload.label, payload.icon, payload.color, payload.active)):
        raise AppError(422, "VALIDATION", "Sin cambios para aplicar")
    service.update_category(db, category_id, label=payload.label, icon=payload.icon, color=payload.color, active=payload.active)
    return {"message": "Categoría actualizada"}


@router.post("/api/admin/place-categories/{category_id:int}/move")
def admin_move(category_id: int, payload: CategoryMoveInput, user: Optional[dict] = Depends(get_current_user),
               db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    service.move_category(db, category_id, payload.direction)
    return {"message": "Orden actualizado"}


@router.delete("/api/admin/place-categories/{category_id:int}")
def admin_delete(category_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    service.delete_category(db, category_id)
    return {"message": "Categoría eliminada"}
