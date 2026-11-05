from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.service.api.caching import revalidated_json
from backend.service.db.session import get_db
from backend.service.services.home_carousel import build_carousel

router = APIRouter()


@router.get("/api/home/carousel")
def home_carousel(request: Request, db: Session = Depends(get_db)):
    """Publico: diapositivas del carrusel del inicio, ya mezcladas (services/home_carousel.py)."""
    return revalidated_json(request, {"slides": build_carousel(db)})
