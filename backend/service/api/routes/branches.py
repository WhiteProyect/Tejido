"""Gestion de cada rama cultural (services/branches.py).

- /api/branches/{branch}/...: ADMIN (cualquier rama) o el LIDER de esa rama. La rama del lider
  se lee de la base; la de la ruta solo dice cual se pide.
- /api/branch-requests y /api/me/branch-request: el ciudadano pide participar en una rama.
Los avisos por correo salen como BackgroundTasks despues del commit, con los destinatarios ya
resueltos.
"""
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_login, require_verified
from backend.service.core.rate_limit import allow_branch_request
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.branches import JoinRequestInput, RejectInput
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORY_LABELS
from backend.service.services import branches as svc
from backend.service.services import notifications

router = APIRouter()


@router.get("/api/branches/{branch}/requests")
def list_requests(branch: str, status: Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"] = "PENDING",
                  user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    branch = svc.require_branch_manager(db, user, branch)
    return svc.list_requests(db, branch, status)


@router.post("/api/branches/{branch}/requests/{request_id}/approve")
def approve_request(branch: str, request_id: int, background_tasks: BackgroundTasks,
                    user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    branch = svc.require_branch_manager(db, user, branch)
    request, applicant = svc.approve_request(db, branch, request_id, user["id"])
    db.commit()
    background_tasks.add_task(notifications.notify_join_decision, applicant.email, applicant.name,
                              CULTURAL_CATEGORY_LABELS[branch], True, None)
    return {"id": request.id, "status": request.status, "user_id": applicant.id}


@router.post("/api/branches/{branch}/requests/{request_id}/reject")
def reject_request(branch: str, request_id: int, payload: RejectInput, background_tasks: BackgroundTasks,
                   user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    branch = svc.require_branch_manager(db, user, branch)
    request, applicant = svc.reject_request(db, branch, request_id, user["id"], payload.note)
    db.commit()
    background_tasks.add_task(notifications.notify_join_decision, applicant.email, applicant.name,
                              CULTURAL_CATEGORY_LABELS[branch], False, request.decision_note)
    return {"id": request.id, "status": request.status, "decision_note": request.decision_note}


@router.get("/api/branches/{branch}/participants")
def list_participants(branch: str, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    branch = svc.require_branch_manager(db, user, branch)
    return svc.list_participants(db, branch)


@router.delete("/api/branches/{branch}/participants/{user_id}")
def remove_participant(branch: str, user_id: int, user: Optional[dict] = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    branch = svc.require_branch_manager(db, user, branch)
    svc.remove_participant(db, branch, user_id, user["id"])
    return {"ok": True}


@router.get("/api/branches/{branch}/review-queue")
def review_queue(branch: str, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    branch = svc.require_branch_manager(db, user, branch)
    return svc.review_queue(db, user, branch)


# ─────────────────────────── ciudadano ───────────────────────────

@router.post("/api/branch-requests", status_code=201)
def create_branch_request(payload: JoinRequestInput, background_tasks: BackgroundTasks,
                          user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesión para pedir participar en una rama")
    if user["role"] != "CIUDADANO":
        raise AppError(409, "ALREADY_MEMBER", "Tu cuenta ya participa en TEJIDO como gestor o administrador")
    require_verified(user)
    if not allow_branch_request(user["id"]):
        raise AppError(429, "RATE_LIMITED", "Hiciste varias solicitudes seguidas. Inténtalo de nuevo más tarde.")
    request = svc.create_request(db, user, payload.branch, payload.message)
    leader = svc.branch_leader(db, request.branch)
    db.commit()
    background_tasks.add_task(notifications.notify_join_request, user["name"], CULTURAL_CATEGORY_LABELS[request.branch],
                              request.message, {"email": leader.email, "name": leader.name} if leader else None)
    return svc.latest_request(db, user["id"])


@router.get("/api/me/branch-request")
def my_branch_request(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user)
    return svc.latest_request(db, user["id"])


@router.delete("/api/me/branch-request")
def cancel_my_branch_request(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user)
    svc.cancel_request(db, user["id"])
    return {"ok": True}
