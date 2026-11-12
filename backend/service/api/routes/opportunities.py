from typing import Optional

from backend.service.services import cultural_branches
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.service.api.caching import revalidated_json
from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services import opportunity_types as types_service
from backend.service.services.opportunities import build_opportunities

router = APIRouter()
ADMIN_ONLY = "Acceso administrativo requerido"


@router.get("/api/opportunity-types")
def opportunity_types(db: Session = Depends(get_db)):
    """Publico: tipos activos, en su orden."""
    return types_service.public_types(db)


@router.get("/api/opportunities")
def opportunities(request: Request, municipality: Optional[str] = Query(default=None), type: Optional[str] = Query(default=None),
                  category: Optional[str] = Query(default=None), soon: str = Query(default="0"),
                  offset: str = Query(default="0"), db: Session = Depends(get_db)):
    """Publico: oportunidades por bloques (services/opportunities.py). Filtros opcionales: municipality
    (slug de los 6), type (slug), category (slug de una rama activa) y soon=1 (cierran en 7 dias o
    menos). offset pagina las cerradas."""
    municipality = (municipality or "").strip().lower() or None
    if municipality and municipality not in MUNICIPALITY_LABELS:
        raise AppError(422, "INVALID_MUNICIPALITY", "Ese municipio no está en TEJIDO")
    type_slug = (type or "").strip().lower() or None
    if type_slug and type_slug not in {item["slug"] for item in types_service.public_types(db)}:
        raise AppError(422, "INVALID_TYPE", "Ese tipo de oportunidad no existe")
    category_slug = (category or "").strip().lower() or None
    # Solo las ramas activas; una desactivada responde como una que no existe (422).
    category_key = cultural_branches.key_by_slug(db, category_slug) if category_slug else None
    if category_slug and category_key is None:
        raise AppError(422, "INVALID_CATEGORY", "Esa categoría cultural no existe")
    if soon not in ("0", "1"):
        raise AppError(422, "INVALID_SOON", "El parámetro soon solo puede ser 0 o 1")
    if not offset.isdigit():
        raise AppError(422, "INVALID_OFFSET", "El parámetro offset debe ser un número entero desde 0")
    data = build_opportunities(db, municipality=municipality, type_slug=type_slug, category=category_key,
                               soon=soon == "1", offset=int(offset))
    return revalidated_json(request, data)


# ───────────────────────── admin: tipos de oportunidad ─────────────────────────

class TypeCreateInput(BaseModel):
    label: str = ""
    color: Optional[str] = None


class TypeUpdateInput(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    active: Optional[bool] = None


class TypeMoveInput(BaseModel):
    direction: str = ""


@router.get("/api/admin/opportunity-types")
def admin_list_types(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    return types_service.admin_types(db)


@router.post("/api/admin/opportunity-types", status_code=201)
def admin_create_type(payload: TypeCreateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    created = types_service.create_type(db, payload.label, payload.color)
    return {"id": created.id, "slug": created.slug, "label": created.label, "color": created.color}


@router.patch("/api/admin/opportunity-types/{type_id:int}")
def admin_update_type(type_id: int, payload: TypeUpdateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    if payload.label is None and payload.active is None and payload.color is None:
        raise AppError(422, "VALIDATION", "Sin cambios para aplicar")
    if payload.label is not None:
        types_service.rename_type(db, type_id, payload.label)
    if payload.color is not None:
        types_service.set_color(db, type_id, payload.color)
    if payload.active is not None:
        types_service.set_active(db, type_id, payload.active)
    return {"message": "Tipo actualizado"}


@router.post("/api/admin/opportunity-types/{type_id:int}/move")
def admin_move_type(type_id: int, payload: TypeMoveInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    types_service.move_type(db, type_id, payload.direction)
    return {"message": "Orden actualizado"}


@router.delete("/api/admin/opportunity-types/{type_id:int}")
def admin_delete_type(type_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    types_service.delete_type(db, type_id)
    return {"message": "Tipo eliminado"}
