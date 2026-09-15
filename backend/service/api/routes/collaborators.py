from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_login
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.models.tables import ActivityType
from backend.service.schemas.collaborators import ReportActivityInput, RedeemInput, ShareInput
from backend.service.services import collaborators as svc
from backend.service.services.serialization import models_to_dicts

router = APIRouter(prefix="/api/collaborators")


@router.get("/profile")
def profile(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user)
    result = svc.get_profile(db, user["id"])
    if not result:
        return {"collaborator": None}
    return result


@router.get("/ranking")
def ranking(db: Session = Depends(get_db)):
    return svc.get_ranking_top(db)


@router.get("/rewards")
def rewards(db: Session = Depends(get_db)):
    return svc.get_rewards_catalog(db)


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return svc.get_stats(db)


@router.get("/activity-types")
def activity_types(db: Session = Depends(get_db)):
    rows = db.execute(select(ActivityType).order_by(ActivityType.name)).scalars().all()
    return models_to_dicts(rows)


@router.post("/register", status_code=201)
def register(user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesion para registrarte")
    return svc.register_collaborator(db, user["id"], user["name"])


@router.post("/share")
def share(payload: ShareInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesion para compartir")
    if not payload.publication_id:
        raise AppError(400, "VALIDATION", "publication_id es requerido")
    result = svc.share_publication(db, user["id"], payload.publication_id)
    if result is None:
        return {"points_earned": 0, "message": "Ya compartiste esta publicacion"}
    return result


@router.post("/report", status_code=201)
def report(payload: ReportActivityInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesion para reportar")
    if not payload.type:
        raise AppError(400, "VALIDATION", "El tipo de actividad es requerido")
    if not payload.description:
        raise AppError(400, "VALIDATION", "La descripcion es requerida")
    return svc.report_activity(db, user["id"], payload.type, payload.description, payload.evidence_url)


@router.post("/redeem")
def redeem(payload: RedeemInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_login(user, "Inicia sesion para canjear")
    if not payload.reward_id:
        raise AppError(400, "VALIDATION", "reward_id es requerido")
    return svc.redeem_reward_by_user(db, user["id"], payload.reward_id)
