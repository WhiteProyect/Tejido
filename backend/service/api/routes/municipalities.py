from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.municipalities import municipality_slug
from backend.service.services.municipalities import municipality_page

router = APIRouter()


@router.get("/api/municipalities/{slug}")
def municipality(slug: str, response: Response, db: Session = Depends(get_db)):
    """Publico: contenido publicado de un municipio (services/municipalities.py)."""
    valid = municipality_slug(slug)
    if valid is None or valid != slug:
        raise AppError(404, "NOT_FOUND", "Municipio no encontrado")
    response.headers["Cache-Control"] = "public, max-age=120"
    return municipality_page(db, valid)
