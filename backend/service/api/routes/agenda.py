from typing import Optional

from backend.service.services import cultural_branches
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from backend.service.api.caching import revalidated_json
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services.agenda import build_agenda

router = APIRouter()


@router.get("/api/agenda")
def agenda(request: Request, municipality: Optional[str] = Query(default=None), category: Optional[str] = Query(default=None),
           past: str = Query(default="0"), offset: str = Query(default="0"), db: Session = Depends(get_db)):
    """Publico: eventos por bloques (services/agenda.py). Filtros opcionales: municipality (slug de los
    6), category (slug de una rama activa) y past=1 (archivo en vez de "pasaron hace poco"; offset
    pagina el archivo)."""
    municipality = (municipality or "").strip().lower() or None
    if municipality and municipality not in MUNICIPALITY_LABELS:
        raise AppError(422, "INVALID_MUNICIPALITY", "Ese municipio no está en TEJIDO")
    category_slug = (category or "").strip().lower() or None
    # Solo las ramas activas; una desactivada responde como una que no existe (422).
    category_key = cultural_branches.key_by_slug(db, category_slug) if category_slug else None
    if category_slug and category_key is None:
        raise AppError(422, "INVALID_CATEGORY", "Esa categoría cultural no existe")
    if past not in ("0", "1"):
        raise AppError(422, "INVALID_PAST", "El parámetro past solo puede ser 0 o 1")
    if not offset.isdigit():
        raise AppError(422, "INVALID_OFFSET", "El parámetro offset debe ser un número entero desde 0")
    data = build_agenda(db, municipality=municipality, category=category_key,
                        past=past == "1", offset=int(offset) if past == "1" else 0)
    return revalidated_json(request, data)
