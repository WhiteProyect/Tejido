from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.service.db.session import get_db
from backend.service.services.home_carousel import build_carousel

router = APIRouter()


@router.get("/api/home/carousel")
def home_carousel(response: Response, db: Session = Depends(get_db)):
    """Publico: diapositivas del carrusel del inicio, ya mezcladas (services/home_carousel.py)."""
    response.headers["Cache-Control"] = "public, max-age=120"
    return {"slides": build_carousel(db)}
