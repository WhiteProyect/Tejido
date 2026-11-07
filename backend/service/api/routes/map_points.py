from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from backend.service.api.caching import revalidated_json
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services.map_points import build_map_points

router = APIRouter()


@router.get("/api/map/points")
def map_points(request: Request, municipality: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    """Publico: puntos del Mapa vivo (services/map_points.py). Filtro opcional municipality (slug)."""
    municipality = (municipality or "").strip().lower() or None
    if municipality and municipality not in MUNICIPALITY_LABELS:
        raise AppError(422, "INVALID_MUNICIPALITY", "Ese municipio no está en TEJIDO")
    return revalidated_json(request, build_map_points(db, municipality=municipality))
