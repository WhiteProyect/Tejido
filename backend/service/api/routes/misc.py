import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel, field_validator
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user
from backend.service.core.rate_limit import allow_suggestion
from backend.service.db.session import engine, get_db
from backend.service.errors import AppError
from backend.service.models.tables import Category, CulturalCategoryCover, Suggestion
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES
from backend.service.services.notifications import notify_suggestion
from backend.service.services.serialization import models_to_dicts

router = APIRouter()
logger = logging.getLogger("tejido.api")


def now_utc():
    return datetime.now(timezone.utc)


@router.get("/api/health")
def health(response: Response):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        database_status = "ok"
    except Exception:
        logger.exception("Health check: la base de datos no responde")
        database_status = "error"
        response.status_code = 503
    return {"status": "ok" if database_status == "ok" else "degraded", "database": database_status, "time": now_utc()}


@router.get("/api/categories")
def categories(db: Session = Depends(get_db)):
    rows = db.execute(select(Category).where(Category.active.is_(True)).order_by(Category.name)).scalars().all()
    return models_to_dicts(rows)


@router.get("/api/cultural-categories/covers")
def cultural_category_covers(response: Response, db: Session = Depends(get_db)):
    """Publico: {clave: url} de las portadas guardadas. Sin fila, el frontend usa la ruta estatica."""
    rows = db.execute(select(CulturalCategoryCover.category_key, CulturalCategoryCover.image_url)).all()
    response.headers["Cache-Control"] = "public, max-age=300"
    return {key: url for key, url in rows if key in CULTURAL_CATEGORIES}


class SuggestionInput(BaseModel):
    message: str = ""

    @field_validator("message", mode="before")
    @classmethod
    def _strip(cls, v):
        return str(v or "").strip()


@router.post("/api/suggestions", status_code=201)
def create_suggestion(payload: SuggestionInput, request: Request, background_tasks: BackgroundTasks,
                      user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not allow_suggestion(client_ip):
        raise AppError(429, "RATE_LIMITED", "Enviaste varios mensajes seguidos. Inténtalo de nuevo en unos minutos.")
    message = payload.message
    if len(message) < 10:
        raise AppError(400, "VALIDATION", "Escribe una sugerencia de al menos 10 caracteres")
    if len(message) > 1000:
        raise AppError(400, "VALIDATION", "La sugerencia no puede superar 1000 caracteres")
    suggestion = Suggestion(user_id=user["id"] if user else None, message=message, status="NEW", created_at=now_utc())
    db.add(suggestion)
    db.flush()
    ticket = f"TEJ-{suggestion.id:04d}"
    # Commit antes del aviso: el correo solo sale si el mensaje ya quedo guardado.
    db.commit()
    background_tasks.add_task(notify_suggestion, ticket, message)
    return {"id": suggestion.id, "ticket": ticket, "message": "Sugerencia recibida"}
