"""Organizacion propia del gestor (su biografia publica).

Siempre se busca por Organization.user_id == el usuario de la sesion: un gestor solo ve y
edita la suya. Rama (branch) y estado (active) quedan fuera: son del admin.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import Organization
from backend.service.schemas.users import OrganizationSelfUpdateInput

NO_ORGANIZATION = "Todavía no tienes una organización asociada, pide a un administrador que te la cree"
SELF_EDITABLE = ("name", "description", "photo_url", "contact")


def _to_dict(org: Organization) -> dict:
    return {"id": org.id, "name": org.name, "description": org.description, "photo_url": org.photo_url,
            "contact": org.contact, "branch": org.branch}


def _find(db: Session, user_id: int) -> Organization:
    org = db.execute(
        select(Organization).where(Organization.user_id == user_id).order_by(Organization.id.asc())
    ).scalars().first()
    if org is None:
        raise AppError(404, "NOT_FOUND", NO_ORGANIZATION)
    return org


def get_my_organization(db: Session, user_id: int) -> dict:
    return _to_dict(_find(db, user_id))


def update_my_organization(db: Session, user_id: int, payload: OrganizationSelfUpdateInput) -> dict:
    org = _find(db, user_id)
    for field in SELF_EDITABLE:
        if field in payload.model_fields_set:
            value = getattr(payload, field)
            if field == "name" and value is None:
                continue  # el nombre no se puede borrar
            setattr(org, field, value)
    db.flush()
    return _to_dict(org)
