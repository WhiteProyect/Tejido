from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, or_, select
from sqlalchemy.orm import Session

from backend.service.db.session import get_db
from backend.service.models.tables import Organization, User
from backend.service.services import org_profiles
from backend.service.services.serialization import rows_to_dicts

router = APIRouter()


@router.get("/api/gestores")
def list_public_gestores(branch: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    """Publico: organizaciones activas de gestores para las pantallas de categoria.

    Solo datos publicos ({id, name, branch, photo_url, is_leader, slug}): nada de contacto ni
    del usuario. El lider de cada rama va primero. slug es null si el admin oculto el perfil.
    Se excluyen las de gestores que aun no aceptan su invitacion o que un admin desactivo
    (User.active = false); las organizaciones sin usuario dependen solo de su propio active.
    """
    conditions = [Organization.active.is_(True), or_(Organization.user_id.is_(None), User.active.is_(True))]
    if branch:
        conditions.append(Organization.branch == branch.strip().upper())
    rows = db.execute(
        select(Organization.id, Organization.name, Organization.branch, Organization.photo_url, Organization.is_leader,
               # Un perfil oculto por el admin no se enlaza (slug null).
               case((Organization.profile_hidden.is_(True), None), else_=Organization.slug).label("slug"))
        .join(User, User.id == Organization.user_id, isouter=True)
        .where(*conditions)
        .order_by(Organization.is_leader.desc(), Organization.name.asc(), Organization.id.asc())
    ).all()
    return rows_to_dicts(rows)


@router.get("/api/gestores/{slug}")
def public_gestor_profile(slug: str, db: Session = Depends(get_db)):
    """Publico: perfil del gestor (#gestor/<slug>). 404 si no existe, si la organizacion o el
    usuario estan inactivos o si el admin oculto el perfil."""
    return org_profiles.public_profile(db, slug)
