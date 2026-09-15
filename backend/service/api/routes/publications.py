from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_login, require_roles
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.models.tables import Favorite, Publication, PublicationImage, Report
from backend.service.schemas.publications import PublicationInput, PublicationStatusInput
from backend.service.services import publications as svc

router = APIRouter()


def now_utc():
    return datetime.now(timezone.utc)


@router.get("/api/publications")
def list_publications(
    mine: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    kind: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    user: Optional[dict] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.list_publications(db, user, mine=mine, status=status, kind=kind, search=search)


@router.get("/api/publications/{publication_id}")
def get_publication_detail(publication_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    row = svc.get_publication(db, user, publication_id)
    if not row:
        raise AppError(404, "NOT_FOUND", "Contenido no encontrado")
    if row["status"] != "PUBLISHED" and (not user or (user["role"] != "ADMIN" and row["author_id"] != user["id"])):
        raise AppError(403, "FORBIDDEN", "No tienes acceso a este contenido")
    return row


@router.get("/api/publications/{publication_id}/images")
def get_publication_images(publication_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    pub = svc.get_publication_owner_state(db, publication_id)
    if not pub:
        raise AppError(404, "NOT_FOUND", "Publicacion no encontrada")
    if pub["status"] != "PUBLISHED" and (not user or (user["role"] != "ADMIN" and pub["author_id"] != user["id"])):
        raise AppError(403, "FORBIDDEN", "No tienes acceso a este contenido")
    return svc.list_publication_images(db, publication_id)


@router.post("/api/publications", status_code=201)
def create_publication(item: PublicationInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user or user["role"] not in ("GESTOR", "ADMIN"):
        raise AppError(403, "FORBIDDEN", "Se requiere rol Gestor o Administrador")
    publication_id = svc.create_publication(db, user, item)
    return {"id": publication_id, "message": "Contenido creado"}


@router.put("/api/publications/{publication_id}")
def update_publication(publication_id: int, item: PublicationInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    current = svc.get_publication_owner_state(db, publication_id)
    if not current:
        raise AppError(404, "NOT_FOUND", "Contenido no encontrado")
    if not user or user["role"] not in ("GESTOR", "ADMIN"):
        raise AppError(403, "FORBIDDEN", "Acceso denegado")
    if current["author_id"] != user["id"] and user["role"] != "ADMIN":
        raise AppError(403, "FORBIDDEN", "No puedes editar este contenido")
    if user["role"] == "GESTOR" and current["status"] not in ("DRAFT", "REJECTED"):
        raise AppError(409, "INVALID_STATE", "Solo puedes editar borradores o contenidos rechazados")
    svc.validate_category(db, item.category_id, item.kind)
    svc.update_publication(db, publication_id, item)
    return {"message": "Contenido actualizado"}


@router.patch("/api/publications/{publication_id}/status")
def moderate_publication(publication_id: int, payload: PublicationStatusInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), "Solo un administrador puede moderar")
    if payload.status not in ("PUBLISHED", "REJECTED"):
        raise AppError(400, "VALIDATION", "El administrador solo puede aprobar o rechazar")
    if payload.status == "REJECTED" and len(payload.note) < 5:
        raise AppError(400, "VALIDATION", "Escribe un motivo de rechazo claro")

    publication = db.execute(
        select(Publication.status).where(Publication.id == publication_id, Publication.deleted.is_(False))
    ).first()
    if not publication:
        raise AppError(404, "NOT_FOUND", "Contenido no encontrado")
    if publication[0] != "REVIEW":
        raise AppError(409, "INVALID_STATE", "Solo se puede moderar contenido que este en revision")

    db.query(Publication).filter(Publication.id == publication_id).update(
        {"status": payload.status, "moderation_note": payload.note or None, "updated_at": now_utc()}
    )
    return {"message": "Estado actualizado"}


@router.delete("/api/publications/{publication_id}")
def delete_publication(publication_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user or user["role"] not in ("GESTOR", "ADMIN"):
        raise AppError(403, "FORBIDDEN", "Acceso denegado")
    q = db.query(Publication).filter(Publication.id == publication_id)
    if user["role"] != "ADMIN":
        q = q.filter(Publication.author_id == user["id"])
    updated = q.update({"deleted": True, "updated_at": now_utc()})
    if updated == 0:
        raise AppError(403, "FORBIDDEN", "No puedes eliminar este contenido")
    return {"message": "Contenido eliminado"}


@router.post("/api/publications/{publication_id}/submit")
def submit_publication(publication_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user or user["role"] not in ("GESTOR", "ADMIN"):
        raise AppError(403, "FORBIDDEN", "Acceso denegado")
    publication = db.execute(
        select(Publication.author_id, Publication.status).where(
            Publication.id == publication_id, Publication.deleted.is_(False)
        )
    ).first()
    if not publication:
        raise AppError(404, "NOT_FOUND", "Contenido no encontrado")
    author_id, status = publication
    if author_id != user["id"] and user["role"] != "ADMIN":
        raise AppError(403, "FORBIDDEN", "No puedes enviar contenido de otro autor")
    if status not in ("DRAFT", "REJECTED"):
        raise AppError(409, "INVALID_STATE", "Solo un borrador o contenido rechazado puede enviarse a revision")
    db.query(Publication).filter(Publication.id == publication_id).update(
        {"status": "REVIEW", "moderation_note": None, "updated_at": now_utc()}
    )
    return {"message": "Enviado a revision"}


@router.post("/api/publications/{publication_id}/favorite")
def add_favorite(publication_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesion para guardar")
    exists = db.execute(
        select(Publication.id).where(
            Publication.id == publication_id, Publication.status == "PUBLISHED", Publication.deleted.is_(False)
        )
    ).first()
    if not exists:
        raise AppError(404, "NOT_FOUND", "La publicacion no esta disponible")
    already = db.execute(
        select(Favorite).where(Favorite.user_id == user["id"], Favorite.publication_id == publication_id)
    ).first()
    if not already:
        db.add(Favorite(user_id=user["id"], publication_id=publication_id, created_at=now_utc()))
    return {"favorite": True}


@router.delete("/api/publications/{publication_id}/favorite")
def remove_favorite(publication_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user)
    db.query(Favorite).filter(
        Favorite.user_id == user["id"], Favorite.publication_id == publication_id
    ).delete()
    return {"favorite": False}


class ReportInput(BaseModel):
    reason: str = ""

    @field_validator("reason", mode="before")
    @classmethod
    def _strip(cls, v):
        return str(v or "").strip()


@router.post("/api/publications/{publication_id}/report", status_code=201)
def report_publication(publication_id: int, payload: ReportInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesion para reportar")
    if len(payload.reason) < 5:
        raise AppError(400, "VALIDATION", "Escribe el motivo del reporte")
    exists = db.execute(
        select(Publication.id).where(
            Publication.id == publication_id, Publication.status == "PUBLISHED", Publication.deleted.is_(False)
        )
    ).first()
    if not exists:
        raise AppError(404, "NOT_FOUND", "La publicacion no esta disponible")
    db.add(Report(user_id=user["id"], publication_id=publication_id, reason=payload.reason, created_at=now_utc()))
    return {"message": "Reporte recibido"}


class ImageInput(BaseModel):
    url: str = ""
    alt_text: str = ""
    caption: Optional[str] = None
    position: Optional[int] = None


@router.post("/api/publications/{publication_id}/images", status_code=201)
def add_publication_image(publication_id: int, payload: ImageInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesion para continuar")
    publication = svc.get_publication_owner_state(db, publication_id)
    if not publication:
        raise AppError(404, "NOT_FOUND", "Publicacion no encontrada")
    if user["role"] != "ADMIN" and publication["author_id"] != user["id"]:
        raise AppError(403, "FORBIDDEN", "No puedes modificar esta publicacion")

    url = (payload.url or "").strip()
    if not url:
        raise AppError(400, "VALIDATION", "La URL es obligatoria")
    parsed_url = urlparse(url)
    if url.startswith("/") and not url.startswith("//"):
        if len(url) > 2000:
            raise AppError(400, "VALIDATION", "La URL es demasiado larga")
    elif parsed_url.scheme != "https" or not parsed_url.netloc:
        raise AppError(400, "VALIDATION", "La URL debe ser una direccion HTTPS valida")
    if len(url) > 2000:
        raise AppError(400, "VALIDATION", "La URL es demasiado larga")

    if payload.position is not None:
        position = payload.position
    else:
        maximum = db.execute(
            select(PublicationImage.position)
            .where(PublicationImage.publication_id == publication_id)
            .order_by(PublicationImage.position.desc())
            .limit(1)
        ).scalar_one_or_none()
        position = (maximum if maximum is not None else -1) + 1
    if position < 0:
        raise AppError(400, "VALIDATION", "La posicion no puede ser negativa")

    already = db.execute(
        select(PublicationImage.id).where(
            PublicationImage.publication_id == publication_id, PublicationImage.position == position
        )
    ).first()
    if already:
        raise AppError(409, "CONFLICT", "Ya existe una imagen en esa posicion")

    image = PublicationImage(
        publication_id=publication_id,
        url=url,
        alt_text=(payload.alt_text or "").strip(),
        caption=(payload.caption or "").strip() or None,
        position=position,
    )
    db.add(image)
    db.flush()
    return {"id": image.id, "url": url, "position": position}


@router.delete("/api/publications/{publication_id}/images/{image_id}")
def delete_publication_image(publication_id: int, image_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesion para continuar")
    publication = svc.get_publication_owner_state(db, publication_id)
    if not publication:
        raise AppError(404, "NOT_FOUND", "Publicacion no encontrada")
    if user["role"] != "ADMIN" and publication["author_id"] != user["id"]:
        raise AppError(403, "FORBIDDEN", "No puedes modificar esta publicacion")
    deleted = db.query(PublicationImage).filter(
        PublicationImage.id == image_id, PublicationImage.publication_id == publication_id
    ).delete()
    if deleted == 0:
        raise AppError(404, "NOT_FOUND", "Imagen no encontrada")
    return {"message": "Imagen eliminada"}
