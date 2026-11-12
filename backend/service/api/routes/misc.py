import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel, field_validator
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_login
from backend.service.core.rate_limit import allow_suggestion
from backend.service.db.session import engine, get_db
from backend.service.errors import AppError
from backend.service.models.tables import Category, CulturalBranch, Suggestion
from backend.service.schemas.fields import our_cloudinary_image
from backend.service.services import branches as branch_service
from backend.service.services import cultural_branches
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


class CoverInput(BaseModel):
    image_url: str

    @field_validator("image_url", mode="before")
    @classmethod
    def _image(cls, v):
        return our_cloudinary_image(v, "tejido/categorias")


def _cover_editor(db: Session, user: Optional[dict], key: str) -> CulturalBranch:
    """El admin edita cualquier portada; el lider, solo la de su rama. Devuelve la rama."""
    require_login(user, "Inicia sesión para cambiar la portada")
    key = branch_service.require_valid_branch(db, key)
    if not branch_service.can_manage_branch(db, user, key):
        raise AppError(403, "FORBIDDEN", "Solo el líder de esta rama o un administrador pueden cambiar su portada")
    return cultural_branches.get_branch(db, key)


# La portada vive en cultural_branches.image_url. Escribir responde {clave: url} de las ramas con imagen y
# sin cache: quien edita ve el cambio al instante.
@router.put("/api/cultural-categories/{key}/cover")
def put_cultural_category_cover(key: str, payload: CoverInput, response: Response, user: Optional[dict] = Depends(get_current_user),
                                db: Session = Depends(get_db)):
    branch = _cover_editor(db, user, key)
    branch.image_url = payload.image_url
    branch.updated_at = datetime.now(timezone.utc)
    db.flush()
    response.headers["Cache-Control"] = "no-store"
    return cultural_branches.covers(db)


@router.delete("/api/cultural-categories/{key}/cover")
def delete_cultural_category_cover(key: str, response: Response, user: Optional[dict] = Depends(get_current_user),
                                   db: Session = Depends(get_db)):
    """Vuelve a la portada estatica (idempotente)."""
    branch = _cover_editor(db, user, key)
    branch.image_url = None
    branch.updated_at = datetime.now(timezone.utc)
    db.flush()
    response.headers["Cache-Control"] = "no-store"
    return cultural_branches.covers(db)


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
