"""Ramas culturales: lider, participantes, solicitudes de ingreso y quien modera que.

Modelo: "lider" no es un rol, es organizations.is_leader (maximo uno por rama, lo fuerza la base).
Un gestor participante es un GESTOR cuya organizacion activa esta en la rama y no es lider.
- Lo que publica un participante lo modera el lider de su rama; lo del lider, el admin.
- Sin lider activo, todo lo que le tocaria al lider lo gestiona el admin.
- Todos los permisos se resuelven con la rama guardada en la base, nunca con la del cliente.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import BranchJoinRequest, Organization, Publication, Role, User
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS
from backend.service.services.serialization import rows_to_dicts


def now_utc():
    return datetime.now(timezone.utc)


def require_valid_branch(branch: str) -> str:
    branch = str(branch or "").strip().upper()
    if branch not in CULTURAL_CATEGORIES:
        raise AppError(404, "NOT_FOUND", "Esa rama cultural no existe")
    return branch


def _role_id(db: Session, name: str) -> int:
    return db.execute(select(Role.id).where(Role.name == name)).scalar_one()


def _organization(db: Session, user_id: int) -> Optional[Organization]:
    return db.execute(select(Organization).where(Organization.user_id == user_id).order_by(Organization.id).limit(1)).scalars().first()


def leader_of(db: Session, user_id: int) -> Optional[str]:
    """Rama que lidera ese usuario (gestor activo con organizacion activa y is_leader), o None."""
    branch = db.execute(
        select(Organization.branch)
        .join(User, User.id == Organization.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Organization.user_id == user_id, Organization.is_leader.is_(True), Organization.active.is_(True),
               User.active.is_(True), Role.name == "GESTOR")
        .limit(1)
    ).scalar_one_or_none()
    return branch if branch in CULTURAL_CATEGORIES else None


def branch_leader(db: Session, branch: str):
    """(user_id, name, email) del lider activo de la rama, o None."""
    return db.execute(
        select(User.id, User.name, User.email)
        .join(Organization, Organization.user_id == User.id)
        .join(Role, Role.id == User.role_id)
        .where(Organization.branch == branch, Organization.is_leader.is_(True), Organization.active.is_(True),
               User.active.is_(True), Role.name == "GESTOR")
        .limit(1)
    ).first()


def participant_branch(db: Session, user_id: int) -> Optional[str]:
    """Rama si el usuario es gestor participante (no lider) con organizacion activa, si no None."""
    branch = db.execute(
        select(Organization.branch)
        .join(User, User.id == Organization.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Organization.user_id == user_id, Organization.is_leader.is_(False), Organization.active.is_(True),
               Role.name == "GESTOR")
        .order_by(Organization.id)
        .limit(1)
    ).scalar_one_or_none()
    return branch if branch in CULTURAL_CATEGORIES else None


def can_manage_branch(db: Session, user: Optional[dict], branch: str) -> bool:
    if not user:
        return False
    if user["role"] == "ADMIN":
        return True
    return user["role"] == "GESTOR" and leader_of(db, user["id"]) == branch


def require_branch_manager(db: Session, user: Optional[dict], branch: str) -> str:
    branch = require_valid_branch(branch)
    if not can_manage_branch(db, user, branch):
        raise AppError(403, "FORBIDDEN", "Solo el líder de esta rama o un administrador pueden gestionarla")
    return branch


def can_moderate(db: Session, user: Optional[dict], publication: dict) -> bool:
    """publication: dict con author_id y cultural_category (tal como estan en la base)."""
    if not user:
        return False
    if user["role"] == "ADMIN":
        return True
    if user["role"] != "GESTOR" or publication["author_id"] == user["id"]:
        return False
    branch = leader_of(db, user["id"])
    return (branch is not None and publication.get("cultural_category") == branch
            and participant_branch(db, publication["author_id"]) == branch)


def moderator_for(db: Session, publication: dict):
    """A quien le toca revisar: el lider (user_id, name, email) si el autor es participante y su
    rama tiene lider activo; si no, "ADMIN"."""
    branch = participant_branch(db, publication["author_id"])
    if branch and publication.get("cultural_category") == branch:
        leader = branch_leader(db, branch)
        if leader and leader.id != publication["author_id"]:
            return leader
    return "ADMIN"


# ─────────────────────────── lider ───────────────────────────

def _gestor_with_org(db: Session, gestor_id: int):
    row = db.execute(
        select(User, Organization)
        .join(Role, Role.id == User.role_id)
        .join(Organization, Organization.user_id == User.id, isouter=True)
        .where(User.id == gestor_id, Role.name == "GESTOR")
        .order_by(Organization.id)
        .limit(1)
    ).first()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Gestor no encontrado")
    return row


def current_leader_row(db: Session, branch: str):
    """Lider marcado en la rama (aunque este inactivo): (user_id, name, email, organization), o None."""
    return db.execute(
        select(User.id, User.name, User.email, Organization.name.label("organization"))
        .join(Organization, Organization.user_id == User.id)
        .where(Organization.branch == branch, Organization.is_leader.is_(True))
        .limit(1)
    ).first()


def set_leader(db: Session, branch: str, gestor_id: int) -> dict:
    """Nombra lider de la rama a ese gestor (debe tener su organizacion en ESA rama). Quita la
    marca al anterior, que queda como participante. Idempotente. No hace commit."""
    branch = require_valid_branch(branch)
    user, org = _gestor_with_org(db, gestor_id)
    if org is None or org.branch != branch:
        current = CULTURAL_CATEGORY_LABELS.get(org.branch) if org else None
        where = f"está en {current}" if current else "no tiene rama asignada"
        raise AppError(409, "OTHER_BRANCH", f"{user.name} {where}: primero asígnale la rama {CULTURAL_CATEGORY_LABELS[branch]}")
    previous = current_leader_row(db, branch)
    if previous and previous.id == user.id:
        return {"branch": branch, "leader_id": user.id, "previous_leader_id": user.id, "changed": False}
    # Primero se quita la marca (el indice unico parcial no admite dos lideres ni un instante).
    db.execute(update(Organization).where(Organization.branch == branch, Organization.is_leader.is_(True)).values(is_leader=False))
    db.flush()
    org.is_leader = True
    db.flush()
    return {"branch": branch, "leader_id": user.id, "previous_leader_id": previous.id if previous else None, "changed": True}


def clear_leader(db: Session, branch: str) -> None:
    branch = require_valid_branch(branch)
    db.execute(update(Organization).where(Organization.branch == branch, Organization.is_leader.is_(True)).values(is_leader=False))
    db.flush()


def branches_overview(db: Session) -> list[dict]:
    participants = dict(db.execute(
        select(Organization.branch, func.count())
        .join(User, User.id == Organization.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Organization.is_leader.is_(False), Organization.active.is_(True), Role.name == "GESTOR")
        .group_by(Organization.branch)
    ).all())
    pending = dict(db.execute(
        select(BranchJoinRequest.branch, func.count()).where(BranchJoinRequest.status == "PENDING").group_by(BranchJoinRequest.branch)
    ).all())
    result = []
    for key, label in CULTURAL_CATEGORY_LABELS.items():
        leader = current_leader_row(db, key)
        result.append({
            "branch": key, "label": label,
            "leader": {"id": leader.id, "name": leader.name, "organization": leader.organization} if leader else None,
            "participants": participants.get(key, 0),
            "pending_requests": pending.get(key, 0),
        })
    return result


# ─────────────────────────── solicitudes ───────────────────────────

def _request_dict(row) -> dict:
    return {
        "id": row.id, "user_id": row.user_id, "name": row.name, "email": row.email, "branch": row.branch,
        "message": row.message, "status": row.status, "decision_note": row.decision_note,
        "created_at": row.created_at, "decided_at": row.decided_at,
    }


def list_requests(db: Session, branch: str, status: str) -> list[dict]:
    query = (
        select(BranchJoinRequest.id, BranchJoinRequest.user_id, User.name, User.email, BranchJoinRequest.branch,
               BranchJoinRequest.message, BranchJoinRequest.status, BranchJoinRequest.decision_note,
               BranchJoinRequest.created_at, BranchJoinRequest.decided_at)
        .join(User, User.id == BranchJoinRequest.user_id)
        .where(BranchJoinRequest.branch == branch)
        .order_by(BranchJoinRequest.created_at.desc(), BranchJoinRequest.id.desc())
    )
    if status != "ALL":
        query = query.where(BranchJoinRequest.status == status)
    return [_request_dict(row) for row in db.execute(query).all()]


def create_request(db: Session, user: dict, branch: str, message: Optional[str]) -> BranchJoinRequest:
    branch = require_valid_branch(branch)
    if user["role"] != "CIUDADANO":
        raise AppError(409, "ALREADY_MEMBER", "Tu cuenta ya participa en TEJIDO como gestor o administrador")
    pending = db.execute(
        select(BranchJoinRequest.id).where(BranchJoinRequest.user_id == user["id"], BranchJoinRequest.status == "PENDING")
    ).first()
    if pending:
        raise AppError(409, "PENDING_REQUEST", "Ya tienes una solicitud pendiente; espera la respuesta o cancélala")
    request = BranchJoinRequest(user_id=user["id"], branch=branch, message=message or None, status="PENDING", created_at=now_utc())
    db.add(request)
    db.flush()
    return request


def latest_request(db: Session, user_id: int) -> Optional[dict]:
    row = db.execute(
        select(BranchJoinRequest).where(BranchJoinRequest.user_id == user_id)
        .order_by(BranchJoinRequest.created_at.desc(), BranchJoinRequest.id.desc()).limit(1)
    ).scalars().first()
    if row is None:
        return None
    return {"id": row.id, "branch": row.branch, "message": row.message, "status": row.status,
            "decision_note": row.decision_note, "created_at": row.created_at, "decided_at": row.decided_at}


def cancel_request(db: Session, user_id: int) -> None:
    request = db.execute(
        select(BranchJoinRequest).where(BranchJoinRequest.user_id == user_id, BranchJoinRequest.status == "PENDING")
    ).scalars().first()
    if request is None:
        raise AppError(404, "NOT_FOUND", "No tienes una solicitud pendiente")
    request.status = "CANCELLED"
    request.decided_at = now_utc()
    db.flush()


def _pending_request(db: Session, branch: str, request_id: int) -> BranchJoinRequest:
    request = db.get(BranchJoinRequest, request_id)
    if request is None or request.branch != branch:
        raise AppError(404, "NOT_FOUND", "Solicitud no encontrada")
    if request.status != "PENDING":
        raise AppError(409, "INVALID_STATE", "Esta solicitud ya fue atendida")
    return request


def approve_request(db: Session, branch: str, request_id: int, decided_by: int) -> tuple[BranchJoinRequest, User]:
    """El solicitante (ciudadano activo) pasa a gestor participante de la rama. No hace commit."""
    request = _pending_request(db, branch, request_id)
    applicant = db.execute(
        select(User).join(Role, Role.id == User.role_id).where(User.id == request.user_id, Role.name == "CIUDADANO", User.active.is_(True))
    ).scalars().first()
    if applicant is None:
        raise AppError(409, "NOT_CITIZEN", "Solo se aprueba a ciudadanos con la cuenta activa (esta persona ya es gestor, admin o está inactiva)")
    applicant.role_id = _role_id(db, "GESTOR")
    org = _organization(db, applicant.id)
    if org is None:
        db.add(Organization(user_id=applicant.id, name=applicant.name, branch=branch, is_leader=False, active=True))
    else:
        org.branch, org.is_leader, org.active = branch, False, True
    request.status, request.decided_by, request.decided_at = "APPROVED", decided_by, now_utc()
    db.flush()
    return request, applicant


def reject_request(db: Session, branch: str, request_id: int, decided_by: int, note: Optional[str]) -> tuple[BranchJoinRequest, User]:
    request = _pending_request(db, branch, request_id)
    request.status, request.decided_by, request.decided_at, request.decision_note = "REJECTED", decided_by, now_utc(), note or None
    db.flush()
    return request, db.get(User, request.user_id)


# ─────────────────────────── participantes ───────────────────────────

def list_participants(db: Session, branch: str) -> list[dict]:
    joined = (
        select(BranchJoinRequest.user_id, func.max(BranchJoinRequest.decided_at).label("joined_at"))
        .where(BranchJoinRequest.branch == branch, BranchJoinRequest.status == "APPROVED")
        .group_by(BranchJoinRequest.user_id).subquery()
    )
    counts = (
        select(Publication.author_id,
               func.count().filter(Publication.status == "PUBLISHED").label("published"),
               func.count().filter(Publication.status == "REVIEW").label("in_review"))
        .where(Publication.deleted.is_(False))
        .group_by(Publication.author_id).subquery()
    )
    rows = db.execute(
        select(User.id, User.name, User.active, Organization.name.label("organization"), Organization.photo_url,
               Organization.is_leader, joined.c.joined_at,
               func.coalesce(counts.c.published, 0).label("published"), func.coalesce(counts.c.in_review, 0).label("in_review"))
        .join(Organization, Organization.user_id == User.id)
        .join(Role, Role.id == User.role_id)
        .join(joined, joined.c.user_id == User.id, isouter=True)
        .join(counts, counts.c.author_id == User.id, isouter=True)
        .where(Organization.branch == branch, Organization.active.is_(True), Role.name == "GESTOR")
        .order_by(Organization.is_leader.desc(), User.name.asc(), User.id.asc())
    ).all()
    return rows_to_dicts(rows)


def remove_participant(db: Session, branch: str, user_id: int, acting_user_id: int) -> None:
    """Saca a un participante: vuelve a CIUDADANO, su organizacion queda inactiva (conserva datos),
    lo que tenia en revision vuelve a borrador; lo publicado sigue visible. No hace commit."""
    if user_id == acting_user_id:
        raise AppError(403, "FORBIDDEN", "No puedes sacarte a ti mismo de la rama")
    row = db.execute(
        select(User, Organization, Role.name)
        .join(Role, Role.id == User.role_id)
        .join(Organization, Organization.user_id == User.id)
        .where(User.id == user_id, Organization.branch == branch, Organization.active.is_(True))
        .limit(1)
    ).first()
    if row is None or row[2] != "GESTOR":
        raise AppError(404, "NOT_FOUND", "Esa persona no participa en esta rama")
    target, org, _ = row
    if org.is_leader:
        raise AppError(403, "FORBIDDEN", "No se puede sacar al líder de la rama; primero quítale el liderazgo")
    target.role_id = _role_id(db, "CIUDADANO")
    org.active = False
    db.execute(update(Publication).where(Publication.author_id == user_id, Publication.status == "REVIEW")
               .values(status="DRAFT", updated_at=now_utc()))
    db.flush()


def review_queue(db: Session, user: dict, branch: str) -> list[dict]:
    """REVIEW de la rama: el admin ve todas; el lider, solo las de sus participantes."""
    query = (
        select(Publication.id, Publication.title, Publication.kind, Publication.status, Publication.created_at,
               Publication.updated_at, Publication.author_id, User.name.label("author"))
        .join(User, User.id == Publication.author_id)
        .where(Publication.cultural_category == branch, Publication.status == "REVIEW", Publication.deleted.is_(False))
        .order_by(Publication.updated_at.asc(), Publication.id.asc())
    )
    if user["role"] != "ADMIN":
        participants = (
            select(Organization.user_id)
            .join(User, User.id == Organization.user_id)
            .join(Role, Role.id == User.role_id)
            .where(Organization.branch == branch, Organization.is_leader.is_(False), Organization.active.is_(True), Role.name == "GESTOR")
        )
        query = query.where(Publication.author_id.in_(participants), Publication.author_id != user["id"])
    return rows_to_dicts(db.execute(query).all())


def me_branch(db: Session, user: dict) -> dict:
    """branch / is_leader para GET /api/me: solo los gestores tienen; los demas, null/false."""
    if user["role"] != "GESTOR":
        return {"branch": None, "is_leader": False}
    org = db.execute(
        select(Organization.branch, Organization.is_leader).where(Organization.user_id == user["id"], Organization.active.is_(True))
        .order_by(Organization.id).limit(1)
    ).first()
    if org is None or org.branch not in CULTURAL_CATEGORIES:
        return {"branch": None, "is_leader": False}
    return {"branch": org.branch, "is_leader": bool(org.is_leader)}
