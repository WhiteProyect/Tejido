"""Usuarios para el admin (pestaña Usuarios del dashboard): listado con filtros, ficha, edicion y cambios
de rol hacia y desde ADMIN. Los cambios que tocan ramas (ciudadano -> gestor, mover de rama, lider) viven
en services/branches.py.

Estado de una cuenta (sin columna nueva): ACTIVO (active); INVITADO = inactiva, con invitacion y ninguna
aceptada (al aceptarla queda una fila de invite_tokens con used_at y reenviar solo borra las no usadas);
INACTIVO = el resto de inactivas (desactivadas por el admin). Solo campos publicos: nunca el hash de la
contrasena ni tokens.
"""
import logging
from typing import Optional

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import BranchJoinRequest, InviteToken, Organization, Publication, Role, Session_ as SessionRow, User
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services.auth import now_utc

logger = logging.getLogger("tejido.admin")

ROLES = ("ADMIN", "GESTOR", "CIUDADANO")
STATUSES = ("ACTIVO", "INACTIVO", "INVITADO")
MIN_QUERY = 2
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 50
NAME_MAX = 120


def _like_term(text: str) -> str:
    """Texto para LIKE con los comodines escapados (\\ es el caracter de escape)."""
    term = text.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{term}%"


def _invited():
    has_invite = select(InviteToken.id).where(InviteToken.user_id == User.id).exists()
    accepted = select(InviteToken.id).where(InviteToken.user_id == User.id, InviteToken.used_at.is_not(None)).exists()
    return and_(User.active.is_(False), has_invite, ~accepted)


def _first_org():
    """Organizacion de cada usuario (la primera por id, la misma que usa services/branches.py)."""
    return select(Organization.user_id, func.min(Organization.id).label("org_id")).group_by(Organization.user_id).subquery()


def _columns():
    return (User.id, User.name, User.email, Role.name.label("role"), User.active, User.email_verified_at, User.municipality,
            User.created_at, _invited().label("invited"), Organization.id.label("organization_id"), Organization.name.label("organization_name"),
            Organization.slug.label("organization_slug"), Organization.branch.label("org_branch"), Organization.is_leader.label("org_leader"),
            Organization.active.label("org_active"))


def _base(first):
    return (select(*_columns()).select_from(User).join(Role, Role.id == User.role_id)
            .join(first, first.c.user_id == User.id, isouter=True)
            .join(Organization, Organization.id == first.c.org_id, isouter=True))


def status_of(active: bool, invited: bool) -> str:
    return "ACTIVO" if active else "INVITADO" if invited else "INACTIVO"


def _item(row, acting_id: Optional[int]) -> dict:
    gestor = row.role == "GESTOR" and bool(row.org_active)
    branch = row.org_branch if gestor and row.org_branch in CULTURAL_CATEGORIES else None
    return {
        "id": row.id, "name": row.name, "email": row.email, "role": row.role, "active": row.active,
        "status": status_of(row.active, bool(row.invited)), "email_verified": row.email_verified_at is not None,
        "municipality": row.municipality, "created_at": row.created_at,
        "branch": branch, "branch_label": CULTURAL_CATEGORY_LABELS.get(branch) if branch else None,
        "is_leader": bool(gestor and row.org_leader and row.active),
        "organization_name": row.organization_name if row.role == "GESTOR" else None,
        "organization_slug": row.organization_slug if row.role == "GESTOR" else None,
        "is_self": acting_id is not None and row.id == acting_id,
    }


def _filters(first, q, status, branch) -> list:
    conditions = []
    if q:
        pattern = _like_term(q)
        conditions.append(or_(func.lower(User.name).like(pattern, escape="\\"), func.lower(User.email).like(pattern, escape="\\")))
    if status == "ACTIVO":
        conditions.append(User.active.is_(True))
    elif status == "INVITADO":
        conditions.append(_invited())
    elif status == "INACTIVO":
        conditions.append(and_(User.active.is_(False), ~_invited()))
    if branch:
        conditions += [Role.name == "GESTOR", Organization.branch == branch, Organization.active.is_(True)]
    return conditions


def list_users(db: Session, acting_id: int, q: Optional[str] = None, role: Optional[str] = None, status: Optional[str] = None,
               branch: Optional[str] = None, page: int = 1, page_size: int = DEFAULT_PAGE_SIZE) -> dict:
    """Pagina de usuarios (alta mas reciente primero) y conteo por rol con los demas filtros. Filtros ya
    validados por la ruta."""
    first = _first_org()
    conditions = _filters(first, q, status, branch)
    with_role = conditions + ([Role.name == role] if role else [])
    query = _base(first).where(*with_role)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(query.order_by(User.created_at.desc(), User.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    by_role = dict(db.execute(
        select(Role.name, func.count(User.id)).select_from(User).join(Role, Role.id == User.role_id)
        .join(first, first.c.user_id == User.id, isouter=True).join(Organization, Organization.id == first.c.org_id, isouter=True)
        .where(*conditions).group_by(Role.name)
    ).all())
    counts = {name: by_role.get(name, 0) for name in ROLES}
    counts["ALL"] = sum(counts.values())
    return {"items": [_item(row, acting_id) for row in rows], "total": total, "page": page, "page_size": page_size, "counts": counts}


def _row(db: Session, user_id: int):
    row = db.execute(_base(_first_org()).where(User.id == user_id)).first()
    if row is None:
        raise AppError(404, "USER_NOT_FOUND", "Usuario no encontrado")
    return row


def get_user(db: Session, user_id: int, acting_id: Optional[int] = None) -> dict:
    return _item(_row(db, user_id), acting_id)


def user_detail(db: Session, user_id: int, acting_id: int) -> dict:
    """Ficha: lo del listado, publicaciones por estado, solicitudes de ingreso recientes y organizacion."""
    row = _row(db, user_id)
    counts = dict(db.execute(
        select(Publication.status, func.count()).where(Publication.author_id == user_id, Publication.deleted.is_(False)).group_by(Publication.status)
    ).all())
    requests = db.execute(
        select(BranchJoinRequest.id, BranchJoinRequest.branch, BranchJoinRequest.status, BranchJoinRequest.created_at, BranchJoinRequest.decided_at)
        .where(BranchJoinRequest.user_id == user_id).order_by(BranchJoinRequest.created_at.desc(), BranchJoinRequest.id.desc()).limit(5)
    ).all()
    organization = None
    if row.organization_id:
        organization = {"id": row.organization_id, "name": row.organization_name, "slug": row.organization_slug, "branch": row.org_branch,
                        "branch_label": CULTURAL_CATEGORY_LABELS.get(row.org_branch), "is_leader": bool(row.org_leader), "active": bool(row.org_active)}
    return {
        **_item(row, acting_id),
        "publications": {status: counts.get(status, 0) for status in ("PUBLISHED", "REVIEW", "DRAFT", "REJECTED")},
        "join_requests": [{"id": r.id, "branch": r.branch, "branch_label": CULTURAL_CATEGORY_LABELS.get(r.branch, r.branch), "status": r.status,
                           "created_at": r.created_at, "decided_at": r.decided_at} for r in requests],
        "organization": organization,
    }


# ─────────────────────────── edicion y roles ───────────────────────────

def _active_admins(db: Session, excluding: Optional[int] = None) -> int:
    query = select(func.count(User.id)).join(Role, Role.id == User.role_id).where(Role.name == "ADMIN", User.active.is_(True))
    if excluding is not None:
        query = query.where(User.id != excluding)
    return db.execute(query).scalar_one()


def _target(db: Session, user_id: int):
    row = db.execute(select(User, Role.name).join(Role, Role.id == User.role_id).where(User.id == user_id)).first()
    if row is None:
        raise AppError(404, "USER_NOT_FOUND", "Usuario no encontrado")
    return row


def _org(db: Session, user_id: int) -> Optional[Organization]:
    return db.execute(select(Organization).where(Organization.user_id == user_id).order_by(Organization.id).limit(1)).scalars().first()


def _role_id(db: Session, name: str) -> int:
    return db.execute(select(Role.id).where(Role.name == name)).scalar_one()


def update_user(db: Session, acting_id: int, user_id: int, fields: dict) -> dict:
    """Nombre, municipio y activo/inactivo (el correo no se edita). Desactivar: nunca a uno mismo ni al
    ultimo admin activo; a un lider le quita el liderazgo (la rama queda libre); a un gestor le conserva su
    organizacion y lo publicado; sus sesiones abiertas se cierran. Reactivar a un INVITADO no se permite
    (tiene que aceptar su invitacion). No hace commit. Devuelve {"leadership_cleared": rama | None}."""
    user, role = _target(db, user_id)
    cleared = None
    if "name" in fields:
        name = " ".join(str(fields["name"] or "").split())
        if not name:
            raise AppError(422, "INVALID_NAME", "Escribe el nombre")
        if len(name) > NAME_MAX:
            raise AppError(422, "INVALID_NAME", f"El nombre no puede superar {NAME_MAX} caracteres")
        user.name = name
    if "municipality" in fields:
        municipality = fields["municipality"] or None
        if municipality is not None and municipality not in MUNICIPALITY_LABELS:
            raise AppError(422, "INVALID_MUNICIPALITY", "Elige uno de los 6 municipios del Bajo Cauca o déjalo vacío")
        user.municipality = municipality
    if "active" in fields and fields["active"] is not None and bool(fields["active"]) != user.active:
        if not fields["active"]:
            if user.id == acting_id:
                raise AppError(409, "SELF_ACTION", "No puedes desactivar tu propia cuenta")
            if role == "ADMIN" and _active_admins(db, excluding=user.id) == 0:
                raise AppError(409, "LAST_ADMIN", "Es el último administrador activo: nombra otro antes de desactivarlo")
            org = _org(db, user.id)
            if role == "GESTOR" and org is not None and org.is_leader:
                cleared = org.branch
                org.is_leader = False
            user.active = False
            db.execute(delete(SessionRow).where(SessionRow.user_id == user.id))
        else:
            invited = db.execute(select(_invited()).select_from(User).where(User.id == user.id)).scalar_one()
            if invited:
                raise AppError(409, "INVITE_PENDING", f"{user.name} aún no acepta su invitación: reenvíala en lugar de activarlo")
            user.active = True
    db.flush()
    return {"leadership_cleared": cleared}


def _log_admin(action: str, actor_id: int, target_id: int, previous_role: str, new_role: str) -> None:
    # Registro estructurado (sin datos sensibles): quien, a quien, accion y cuando.
    logger.info("admin_role_change action=%s actor_id=%s target_id=%s from=%s to=%s at=%s",
                action, actor_id, target_id, previous_role, new_role, now_utc().isoformat())


def make_admin(db: Session, acting_id: int, user_id: int) -> dict:
    """CIUDADANO o GESTOR no lider -> ADMIN. El gestor deja su organizacion inactiva (conserva datos) y lo
    suyo en revision vuelve a borrador. No hace commit."""
    user, role = _target(db, user_id)
    if role == "ADMIN":
        raise AppError(409, "ALREADY_ADMIN", f"{user.name} ya es administrador")
    if not user.active:
        raise AppError(409, "INACTIVE_USER", f"La cuenta de {user.name} está inactiva: actívala antes")
    if user.email_verified_at is None:
        raise AppError(409, "EMAIL_NOT_VERIFIED", f"{user.name} aún no verifica su correo: pídele que lo confirme antes")
    drafted = 0
    if role == "GESTOR":
        org = _org(db, user.id)
        if org is not None and org.is_leader:
            label = CULTURAL_CATEGORY_LABELS.get(org.branch, org.branch)
            raise AppError(409, "IS_LEADER", f"{user.name} es líder de {label}: primero quítale el liderazgo")
        if org is not None:
            org.active = False
        drafted = db.execute(update(Publication).where(Publication.author_id == user.id, Publication.status == "REVIEW")
                             .values(status="DRAFT", updated_at=now_utc())).rowcount or 0
    user.role_id = _role_id(db, "ADMIN")
    db.flush()
    _log_admin("grant", acting_id, user.id, role, "ADMIN")
    return {"user_id": user.id, "role": "ADMIN", "previous_role": role, "drafted": drafted}


def revoke_admin(db: Session, acting_id: int, user_id: int) -> dict:
    """ADMIN -> CIUDADANO. Nunca sobre uno mismo ni sobre el ultimo admin activo. No hace commit."""
    user, role = _target(db, user_id)
    if role != "ADMIN":
        raise AppError(409, "NOT_ADMIN", f"{user.name} no es administrador")
    if user.id == acting_id:
        raise AppError(409, "SELF_ACTION", "No puedes quitarte a ti mismo el rol de administrador")
    if user.active and _active_admins(db, excluding=user.id) == 0:
        raise AppError(409, "LAST_ADMIN", "Es el último administrador activo: nombra otro antes")
    user.role_id = _role_id(db, "CIUDADANO")
    db.flush()
    _log_admin("revoke", acting_id, user.id, "ADMIN", "CIUDADANO")
    return {"user_id": user.id, "role": "CIUDADANO", "previous_role": "ADMIN"}


def gestor_branch(db: Session, user_id: int) -> Optional[str]:
    """Rama activa de un GESTOR (para sacarlo de ella), o None."""
    row = db.execute(
        select(Organization.branch).join(User, User.id == Organization.user_id).join(Role, Role.id == User.role_id)
        .where(User.id == user_id, Role.name == "GESTOR", Organization.active.is_(True)).order_by(Organization.id).limit(1)
    ).first()
    return row.branch if row else None
