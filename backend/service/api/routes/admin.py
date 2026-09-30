import logging
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.models.tables import Organization, Publication, Report, Role, Suggestion, User
from backend.service.schemas.organizations import GestorCreateInput, GestorUpdateInput
from backend.service.services import email as email_service
from backend.service.services.auth import now_utc
from backend.service.services.invites import create_invite, invite_link, unusable_password_hash
from backend.service.services.serialization import rows_to_dicts

router = APIRouter(prefix="/api/admin")
logger = logging.getLogger("tejido.api")

ADMIN_ONLY = "Acceso administrativo requerido"


@router.get("/stats")
def stats(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), "Acceso administrativo requerido")
    published = db.execute(
        select(func.count()).select_from(Publication).where(Publication.status == "PUBLISHED", Publication.deleted.is_(False))
    ).scalar_one()
    pending = db.execute(
        select(func.count()).select_from(Publication).where(Publication.status == "REVIEW", Publication.deleted.is_(False))
    ).scalar_one()
    users = db.execute(select(func.count()).select_from(User).where(User.active.is_(True))).scalar_one()
    reports = db.execute(select(func.count()).select_from(Report).where(Report.status == "OPEN")).scalar_one()
    suggestions = db.execute(select(func.count()).select_from(Suggestion).where(Suggestion.status == "NEW")).scalar_one()
    return {"published": published, "pending": pending, "users": users, "reports": reports, "suggestions": suggestions}


@router.get("/suggestions")
def list_suggestions(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), "Acceso administrativo requerido")
    rows = db.execute(
        select(Suggestion.id, Suggestion.message, Suggestion.status, Suggestion.created_at,
               User.name.label("user_name"), User.email.label("user_email"))
        .join(User, User.id == Suggestion.user_id, isouter=True)
        .order_by(Suggestion.created_at.desc())
        .limit(50)
    ).all()
    return rows_to_dicts(rows)


# ---------------------------------------------------------------------------
# Gestores: alta por invitacion, listado, edicion y reenvio.
# ---------------------------------------------------------------------------

def _gestor_role_id(db: Session) -> int:
    return db.execute(select(Role.id).where(Role.name == "GESTOR")).scalar_one()


def _send_invite(user: User, token: str) -> tuple[str, bool]:
    """Intenta mandar el correo. Si falla (sin API key, red, dominio sin verificar) no
    rompe el alta: se loguea y el admin recibe el link para compartirlo a mano."""
    link = invite_link(token)
    try:
        email_service.send_invite_email(user.email, user.name, link)
        return link, True
    except Exception:
        logger.exception("No se pudo enviar la invitacion a user_id=%s", user.id)
        return link, False


def _get_gestor(db: Session, gestor_id: int) -> User:
    user = db.execute(
        select(User).join(Role, Role.id == User.role_id).where(User.id == gestor_id, Role.name == "GESTOR")
    ).scalar_one_or_none()
    if user is None:
        raise AppError(404, "NOT_FOUND", "Gestor no encontrado")
    return user


def _status(active: bool) -> str:
    # Sin estado "desactivado" aparte: se reusa el booleano active de User.
    return "ACTIVO" if active else "PENDIENTE"


@router.post("/gestores")
def create_gestor(payload: GestorCreateInput, user: Optional[dict] = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    if db.execute(select(User.id).where(func.lower(User.email) == payload.email)).first():
        raise AppError(409, "EMAIL_IN_USE", "Ya existe una cuenta con ese correo")

    gestor = User(
        role_id=_gestor_role_id(db), name=payload.name, email=payload.email,
        password_hash=unusable_password_hash(), active=False, created_at=now_utc(),
    )
    db.add(gestor)
    db.flush()
    organization = Organization(
        user_id=gestor.id, name=payload.organization_name, branch=payload.branch, contact=payload.contact,
    )
    db.add(organization)
    db.flush()
    token = create_invite(db, gestor.id)
    # Commit antes de enviar: el link del correo siempre apunta a un token ya guardado.
    db.commit()

    link, email_sent = _send_invite(gestor, token)
    return {"user_id": gestor.id, "organization_id": organization.id, "invite_link": link, "email_sent": email_sent}


@router.get("/gestores")
def list_gestores(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    rows = db.execute(
        select(User.id, User.name, User.email, User.active, User.created_at,
               Organization.id.label("organization_id"), Organization.name.label("organization_name"),
               Organization.branch, Organization.contact)
        .join(Role, Role.id == User.role_id)
        .join(Organization, Organization.user_id == User.id, isouter=True)
        .where(Role.name == "GESTOR")
        .order_by(User.created_at.desc(), User.id.desc())
    ).all()
    gestores = rows_to_dicts(rows)
    for g in gestores:
        g["status"] = _status(g["active"])
    return gestores


@router.patch("/gestores/{gestor_id}")
def update_gestor(gestor_id: int, payload: GestorUpdateInput, user: Optional[dict] = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    gestor = _get_gestor(db, gestor_id)
    sent = payload.model_fields_set

    if "active" in sent and payload.active is not None:
        gestor.active = payload.active
    org_fields = {f: getattr(payload, f) for f in ("organization_name", "branch", "contact") if f in sent}
    if org_fields:
        organization = db.execute(select(Organization).where(Organization.user_id == gestor.id)).scalars().first()
        if organization is None:
            if not org_fields.get("organization_name"):
                raise AppError(400, "VALIDATION", "El gestor no tiene organizacion: envia organization_name para crearla")
            organization = Organization(user_id=gestor.id, name=org_fields["organization_name"])
            db.add(organization)
        if org_fields.get("organization_name"):
            organization.name = org_fields["organization_name"]
        if org_fields.get("branch"):
            organization.branch = org_fields["branch"]
        if "contact" in org_fields:
            organization.contact = org_fields["contact"] or None
    db.flush()
    return {"ok": True, "id": gestor.id, "active": gestor.active, "status": _status(gestor.active)}


@router.post("/gestores/{gestor_id}/resend-invite")
def resend_invite(gestor_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    gestor = _get_gestor(db, gestor_id)
    if gestor.active:
        raise AppError(409, "ALREADY_ACTIVE", "El gestor ya activo su cuenta")
    token = create_invite(db, gestor.id)
    db.commit()
    link, email_sent = _send_invite(gestor, token)
    return {"user_id": gestor.id, "invite_link": link, "email_sent": email_sent}
