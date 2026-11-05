from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from backend.service.api.caching import revalidated_json
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services.agenda import CATEGORY_BY_SLUG, build_agenda

router = APIRouter()


@router.get("/api/agenda")
def agenda(request: Request, municipality: Optional[str] = Query(default=None), category: Optional[str] = Query(default=None),
           past: str = Query(default="0"), offset: str = Query(default="0"), db: Session = Depends(get_db)):
    """Publico: eventos por bloques (services/agenda.py). Filtros opcionales: municipality (slug de los
    6), category (slug de las 10 categorias) y past=1 (archivo en vez de "pasaron hace poco"; offset
    pagina el archivo)."""
    municipality = (municipality or "").strip().lower() or None
    if municipality and municipality not in MUNICIPALITY_LABELS:
        raise AppError(422, "INVALID_MUNICIPALITY", "Ese municipio no está en TEJIDO")
    category_slug = (category or "").strip().lower() or None
    if category_slug and category_slug not in CATEGORY_BY_SLUG:
        raise AppError(422, "INVALID_CATEGORY", "Esa categoría cultural no existe")
    if past not in ("0", "1"):
        raise AppError(422, "INVALID_PAST", "El parámetro past solo puede ser 0 o 1")
    if not offset.isdigit():
        raise AppError(422, "INVALID_OFFSET", "El parámetro offset debe ser un número entero desde 0")
    data = build_agenda(db, municipality=municipality, category=CATEGORY_BY_SLUG.get(category_slug),
                        past=past == "1", offset=int(offset) if past == "1" else 0)
    return revalidated_json(request, data)
