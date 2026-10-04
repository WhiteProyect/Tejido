from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.service.db.session import get_db
from backend.service.models.tables import Organization, User
from backend.service.services.serialization import rows_to_dicts

router = APIRouter()


@router.get("/api/gestores")
def list_public_gestores(branch: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    """Publico: organizaciones activas de gestores para las pantallas de categoria.

    Solo datos publicos ({id, name, branch, photo_url}): nada de contacto ni del usuario.
    Se excluyen las de gestores que aun no aceptan su invitacion o que un admin desactivo
    (User.active = false); las organizaciones sin usuario dependen solo de su propio active.
    """
    conditions = [Organization.active.is_(True), or_(Organization.user_id.is_(None), User.active.is_(True))]
    if branch:
        conditions.append(Organization.branch == branch.strip().upper())
    rows = db.execute(
        select(Organization.id, Organization.name, Organization.branch, Organization.photo_url)
        .join(User, User.id == Organization.user_id, isouter=True)
        .where(*conditions)
        .order_by(Organization.name.asc(), Organization.id.asc())
    ).all()
    return rows_to_dicts(rows)
