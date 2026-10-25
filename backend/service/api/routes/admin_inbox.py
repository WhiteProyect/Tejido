"""Bandeja del admin: mensajes del formulario de Nosotros (suggestions) y reportes de
publicaciones (reports). Solo ADMIN. Atender un reporte no toca la publicacion: si hay que
despublicarla, el admin lo hace desde la pestana Publicaciones."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.models.tables import Publication, Report, Suggestion, User
from backend.service.services.auth import now_utc
from backend.service.services.serialization import fix_text, rows_to_dicts
from backend.service.services.suggestions import split_message

router = APIRouter(prefix="/api/admin")

ADMIN_ONLY = "Acceso administrativo requerido"
PAGE_LIMIT = 20
MAX_LIMIT = 50


def _page(query, page: int, limit: int):
    return query.offset((page - 1) * limit).limit(limit)


def _count(db: Session, query) -> int:
    return db.execute(select(func.count()).select_from(query.order_by(None).subquery())).scalar_one()


# ─────────────────────────── mensajes ───────────────────────────

class SuggestionStatusInput(BaseModel):
    status: Literal["NEW", "READ", "ARCHIVED"]


@router.get("/suggestions")
def list_suggestions(
    status: Literal["NEW", "READ", "ARCHIVED", "ALL"] = "ALL",
    page: int = Query(1, ge=1),
    limit: int = Query(PAGE_LIMIT, ge=1, le=MAX_LIMIT),
    user: Optional[dict] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    query = (
        select(Suggestion.id, Suggestion.message, Suggestion.status, Suggestion.created_at, Suggestion.reviewed_at,
               User.name.label("user_name"), User.email.label("user_email"))
        .join(User, User.id == Suggestion.user_id, isouter=True)
        .order_by(Suggestion.created_at.desc(), Suggestion.id.desc())
    )
    if status != "ALL":
        query = query.where(Suggestion.status == status)
    items = rows_to_dicts(db.execute(_page(query, page, limit)).all())
    for item in items:
        name, contact, text = split_message(item["message"])
        item.update(name=name or item["user_name"], contact=contact or item["user_email"], text=text)
    pending = db.execute(select(func.count()).select_from(Suggestion).where(Suggestion.status == "NEW")).scalar_one()
    return {"items": items, "total": _count(db, query), "pending": pending, "page": page, "limit": limit}


@router.patch("/suggestions/{suggestion_id}")
def update_suggestion(suggestion_id: int, payload: SuggestionStatusInput,
                      user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    suggestion = db.get(Suggestion, suggestion_id)
    if suggestion is None:
        raise AppError(404, "NOT_FOUND", "Mensaje no encontrado")
    suggestion.status = payload.status
    suggestion.reviewed_at = None if payload.status == "NEW" else now_utc()
    db.flush()
    return {"id": suggestion.id, "status": suggestion.status, "reviewed_at": suggestion.reviewed_at}


# ─────────────────────────── reportes ───────────────────────────

class ReportStatusInput(BaseModel):
    status: Literal["OPEN", "RESOLVED", "DISMISSED"]
    note: Optional[str] = None

    @field_validator("note", mode="before")
    @classmethod
    def _note(cls, v):
        v = str(v or "").strip()
        if len(v) > 500:
            raise ValueError("La nota no puede superar 500 caracteres")
        return v or None


@router.get("/reports")
def list_reports(
    status: Literal["OPEN", "RESOLVED", "DISMISSED", "ALL"] = "OPEN",
    page: int = Query(1, ge=1),
    limit: int = Query(PAGE_LIMIT, ge=1, le=MAX_LIMIT),
    user: Optional[dict] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    reporter = aliased(User)
    # outer join a la publicacion: un reporte nunca debe romper el listado, aunque la
    # publicacion este borrada (deleted) o ya no exista.
    query = (
        select(Report.id, Report.reason, Report.status, Report.created_at, Report.resolution_note, Report.resolved_at,
               reporter.name.label("reporter_name"), Report.publication_id,
               Publication.title.label("publication_title"), Publication.status.label("publication_status"),
               Publication.kind.label("publication_kind"), Publication.deleted.label("publication_deleted"))
        .join(reporter, reporter.id == Report.user_id, isouter=True)
        .join(Publication, Publication.id == Report.publication_id, isouter=True)
        .order_by(Report.created_at.desc(), Report.id.desc())
    )
    if status != "ALL":
        query = query.where(Report.status == status)
    items = []
    for row in rows_to_dicts(db.execute(_page(query, page, limit)).all()):
        items.append({
            "id": row["id"], "reason": row["reason"], "status": row["status"], "created_at": row["created_at"],
            "resolution_note": row["resolution_note"], "resolved_at": row["resolved_at"],
            "reporter_name": row["reporter_name"],
            "publication": {
                "id": row["publication_id"], "title": fix_text(row["publication_title"]),
                "status": row["publication_status"], "kind": row["publication_kind"],
                "deleted": bool(row["publication_deleted"]) if row["publication_title"] is not None else True,
            },
        })
    pending = db.execute(select(func.count()).select_from(Report).where(Report.status == "OPEN")).scalar_one()
    return {"items": items, "total": _count(db, query), "pending": pending, "page": page, "limit": limit}


@router.patch("/reports/{report_id}")
def update_report(report_id: int, payload: ReportStatusInput,
                  user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    report = db.get(Report, report_id)
    if report is None:
        raise AppError(404, "NOT_FOUND", "Reporte no encontrado")
    report.status = payload.status
    if payload.status == "OPEN":
        report.resolution_note = None
        report.resolved_at = None
    else:
        report.resolution_note = payload.note
        report.resolved_at = now_utc()
    db.flush()
    return {"id": report.id, "status": report.status, "resolution_note": report.resolution_note,
            "resolved_at": report.resolved_at}
