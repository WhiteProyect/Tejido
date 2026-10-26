import logging
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.models.tables import BranchJoinRequest, Organization, Publication, Report, Role, Suggestion, User
from backend.service.schemas.branches import LeaderInput
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORY_LABELS
from backend.service.schemas.organizations import GestorCreateInput, GestorUpdateInput
from backend.service.services import artists as artists_service
from backend.service.services import branches as branch_service
from backend.service.services import email as email_service
from backend.service.services import notifications
from backend.service.services import org_profiles
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
    gestores_activos = db.execute(
        select(func.count()).select_from(User).join(Role, Role.id == User.role_id)
        .where(Role.name == "GESTOR", User.active.is_(True))
    ).scalar_one()
    reports = db.execute(select(func.count()).select_from(Report).where(Report.status == "OPEN")).scalar_one()
    suggestions = db.execute(select(func.count()).select_from(Suggestion).where(Suggestion.status == "NEW")).scalar_one()
    join_requests = db.execute(
        select(func.count()).select_from(BranchJoinRequest).where(BranchJoinRequest.status == "PENDING")
    ).scalar_one()
    return {"published": published, "pending": pending, "users": users, "gestores_activos": gestores_activos,
            "reports": reports, "suggestions": suggestions, "join_requests": join_requests}


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
def create_gestor(payload: GestorCreateInput, background_tasks: BackgroundTasks,
                  user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    if db.execute(select(User.id).where(func.lower(User.email) == payload.email)).first():
        raise AppError(409, "EMAIL_IN_USE", "Ya existe una cuenta con ese correo")

    gestor = User(
        role_id=_gestor_role_id(db), name=payload.name, email=payload.email,
        password_hash=unusable_password_hash(), active=False, created_at=now_utc(),
    )
    db.add(gestor)
    db.flush()
    if payload.is_leader and branch_service.current_leader_row(db, payload.branch):
        raise AppError(409, "LEADER_EXISTS", "Esa rama ya tiene líder: quítale el liderazgo antes de nombrar otro")
    organization = Organization(
        user_id=gestor.id, name=payload.organization_name, branch=payload.branch, contact=payload.contact,
        is_leader=payload.is_leader,
    )
    org_profiles.ensure_slug(db, organization)
    db.add(organization)
    db.flush()
    token = create_invite(db, gestor.id)
    # Commit antes de enviar: el link del correo siempre apunta a un token ya guardado.
    db.commit()

    link, email_sent = _send_invite(gestor, token)
    if payload.is_leader:
        background_tasks.add_task(notifications.notify_leader_appointed, gestor.email, gestor.name,
                                  CULTURAL_CATEGORY_LABELS[payload.branch])
    return {"user_id": gestor.id, "organization_id": organization.id, "invite_link": link, "email_sent": email_sent}


@router.get("/gestores")
def list_gestores(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    rows = db.execute(
        select(User.id, User.name, User.email, User.active, User.created_at,
               Organization.id.label("organization_id"), Organization.name.label("organization_name"),
               Organization.branch, Organization.contact, Organization.photo_url, Organization.is_leader,
               Organization.slug, Organization.profile_hidden)
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
    org_fields = {f: getattr(payload, f) for f in ("organization_name", "branch", "contact", "photo_url") if f in sent}
    if org_fields:
        organization = db.execute(select(Organization).where(Organization.user_id == gestor.id)).scalars().first()
        if organization is None:
            if not org_fields.get("organization_name"):
                raise AppError(400, "VALIDATION", "El gestor no tiene organizacion: envia organization_name para crearla")
            organization = Organization(user_id=gestor.id, name=org_fields["organization_name"])
            org_profiles.ensure_slug(db, organization)
            db.add(organization)
        if org_fields.get("organization_name"):
            organization.name = org_fields["organization_name"]
        if org_fields.get("branch"):
            if organization.is_leader and org_fields["branch"] != organization.branch:
                raise AppError(409, "IS_LEADER", "Este gestor es líder de su rama: quita primero el liderazgo para cambiarlo de rama")
            organization.branch = org_fields["branch"]
        if "contact" in org_fields:
            organization.contact = org_fields["contact"] or None
        if "photo_url" in org_fields:
            organization.photo_url = org_fields["photo_url"] or None
    if "profile_hidden" in sent and payload.profile_hidden is not None:
        organization = db.execute(select(Organization).where(Organization.user_id == gestor.id)).scalars().first()
        if organization is None:
            raise AppError(409, "NO_ORGANIZATION", "Este gestor no tiene organización ni perfil público")
        organization.profile_hidden = payload.profile_hidden
    db.flush()
    return {"ok": True, "id": gestor.id, "active": gestor.active, "status": _status(gestor.active)}


@router.get("/artists")
def list_artists(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Todos los artistas, tambien los archivados (la web publica solo ve los activos)."""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    return artists_service.list_artists_admin(db)


@router.get("/artists/{artist_id:int}")
def artist_detail(artist_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Un artista completo para editarlo, aunque este archivado o tenga canciones en borrador."""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    data = artists_service.get_artist_admin_detail(db, artist_id)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


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


# ---------------------------------------------------------------------------
# Lider de cada rama (solo ADMIN). La gestion de la rama vive en routes/branches.py.
# ---------------------------------------------------------------------------

@router.get("/branches")
def list_branches(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Las 10 ramas con su lider (o null), participantes y solicitudes pendientes."""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    return branch_service.branches_overview(db)


@router.get("/branch-requests")
def list_branch_requests(status: Literal["PENDING", "ALL"] = "PENDING", user: Optional[dict] = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    """Bandeja: solicitudes de ingreso de todas las ramas (con branch_label y branch_has_leader)."""
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    return branch_service.list_all_requests(db, status)


@router.put("/branches/{branch}/leader")
def put_branch_leader(branch: str, payload: LeaderInput, background_tasks: BackgroundTasks,
                      user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    result = branch_service.set_leader(db, branch, payload.gestor_id)
    if result["changed"]:
        # Aviso al nombrado (no al reconfirmar a quien ya era lider). Commit antes del aviso.
        db.commit()
        gestor = db.get(User, payload.gestor_id)
        background_tasks.add_task(notifications.notify_leader_appointed, gestor.email, gestor.name,
                                  CULTURAL_CATEGORY_LABELS[result["branch"]])
    return result


@router.delete("/branches/{branch}/leader")
def delete_branch_leader(branch: str, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    branch_service.clear_leader(db, branch)
    return {"ok": True}
