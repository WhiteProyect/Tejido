import secrets
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import (
    ActivityType,
    Collaborator,
    CollaboratorActivity,
    Reward,
    RewardRedemption,
    User,
)
from backend.service.services.serialization import model_to_dict, models_to_dicts, row_to_dict, rows_to_dicts

LEVELS = {"INICIADO": 0, "ACTIVO": 500, "EMBAJADOR": 2000, "LIDER": 5000}
LEVEL_ORDER = ["INICIADO", "ACTIVO", "EMBAJADOR", "LIDER"]


def now_utc():
    return datetime.now(timezone.utc)


def calculate_level(points: int) -> str:
    if points >= 5000:
        return "LIDER"
    if points >= 2000:
        return "EMBAJADOR"
    if points >= 500:
        return "ACTIVO"
    return "INICIADO"


def next_level(current_level: str):
    idx = LEVEL_ORDER.index(current_level) if current_level in LEVEL_ORDER else 0
    if idx < len(LEVEL_ORDER) - 1:
        return LEVEL_ORDER[idx + 1]
    return None


def points_for_next_level(current_level: str) -> int:
    nxt = next_level(current_level)
    return LEVELS[nxt] if nxt else LEVELS["LIDER"]


def generate_code(name: str) -> str:
    prefix = name.split()[0].upper()[:6] if name else "USER"
    suffix = secrets.token_urlsafe(4).upper()
    return f"{prefix}-{suffix}"


def _get_collaborator_by_user(db: Session, user_id: int):
    return db.execute(
        select(Collaborator).where(Collaborator.user_id == user_id, Collaborator.active.is_(True))
    ).scalar_one_or_none()


def register_collaborator(db: Session, user_id: int, user_name: str):
    if _get_collaborator_by_user(db, user_id):
        raise AppError(400, "VALIDATION", "Ya eres colaborador de TEJIDO")

    code = generate_code(user_name)
    collaborator = Collaborator(user_id=user_id, code=code, points=0, level="INICIADO", created_at=now_utc())
    db.add(collaborator)
    db.flush()
    return {"id": collaborator.id, "code": code, "points": 0, "level": "INICIADO"}


def get_ranking_top(db: Session, limit: int = 10):
    rows = db.execute(
        select(Collaborator.id, Collaborator.points, Collaborator.level, User.name)
        .join(User, User.id == Collaborator.user_id)
        .where(Collaborator.active.is_(True))
        .order_by(Collaborator.points.desc())
        .limit(limit)
    ).all()
    return rows_to_dicts(rows)


def get_profile(db: Session, user_id: int):
    collaborator = _get_collaborator_by_user(db, user_id)
    if not collaborator:
        return None

    activities = db.execute(
        select(CollaboratorActivity)
        .where(CollaboratorActivity.collaborator_id == collaborator.id)
        .order_by(CollaboratorActivity.created_at.desc())
        .limit(20)
    ).scalars().all()

    redemptions = db.execute(
        select(RewardRedemption.__table__, Reward.name.label("reward_name"), Reward.category.label("reward_category"))
        .join(Reward, Reward.id == RewardRedemption.reward_id)
        .where(RewardRedemption.collaborator_id == collaborator.id)
        .order_by(RewardRedemption.created_at.desc())
    ).all()

    ranking = get_ranking_top(db, 10)
    user_position = None
    for i, r in enumerate(ranking):
        if r["id"] == collaborator.id:
            user_position = i + 1
            break

    collab_dict = model_to_dict(collaborator)
    return {
        "collaborator": collab_dict,
        "activities": models_to_dicts(activities),
        "redemptions": rows_to_dicts(redemptions),
        "ranking": ranking,
        "user_position": user_position,
        "next_level": next_level(collab_dict["level"]),
        "points_for_next": points_for_next_level(collab_dict["level"]),
    }


def _add_points(db: Session, collaborator: Collaborator, points: int):
    collaborator.points = collaborator.points + points
    new_level = calculate_level(collaborator.points)
    if new_level != collaborator.level:
        collaborator.level = new_level
    return collaborator.points, collaborator.level


def share_publication(db: Session, user_id: int, publication_id: int):
    collaborator = _get_collaborator_by_user(db, user_id)
    if not collaborator:
        return None

    already_shared = db.execute(
        select(CollaboratorActivity.id).where(
            CollaboratorActivity.collaborator_id == collaborator.id,
            CollaboratorActivity.type == "INTERNAL_SHARE",
            CollaboratorActivity.publication_id == publication_id,
        )
    ).first()
    if already_shared:
        return None

    db.add(
        CollaboratorActivity(
            collaborator_id=collaborator.id,
            type="INTERNAL_SHARE",
            points=10,
            description="Compartió una publicación",
            evidence_url=None,
            publication_id=publication_id,
            status="APPROVED",
            created_at=now_utc(),
        )
    )
    new_total, new_level = _add_points(db, collaborator, 10)
    return {"points_earned": 10, "new_total": new_total, "new_level": new_level}


def report_activity(db: Session, user_id: int, activity_type: str, description: str, evidence_url=None):
    collaborator = _get_collaborator_by_user(db, user_id)
    if not collaborator:
        raise AppError(400, "VALIDATION", "No eres colaborador")

    act_type = db.execute(select(ActivityType).where(ActivityType.type == activity_type)).scalar_one_or_none()
    if not act_type:
        raise AppError(400, "VALIDATION", "Tipo de actividad no válido")

    points = act_type.default_points
    db.add(
        CollaboratorActivity(
            collaborator_id=collaborator.id,
            type=activity_type,
            points=points,
            description=description,
            evidence_url=evidence_url,
            publication_id=None,
            status="APPROVED",
            created_at=now_utc(),
        )
    )
    new_total, new_level = _add_points(db, collaborator, points)
    return {"points_earned": points, "new_total": new_total, "new_level": new_level}


def get_rewards_catalog(db: Session):
    rewards = db.execute(
        select(Reward)
        .where(Reward.active.is_(True), (Reward.stock == -1) | (Reward.stock > 0))
        .order_by(Reward.points_cost)
    ).scalars().all()
    return models_to_dicts(rewards)


def redeem_reward_by_user(db: Session, user_id: int, reward_id: int):
    collaborator = _get_collaborator_by_user(db, user_id)
    if not collaborator:
        raise AppError(400, "VALIDATION", "No eres colaborador")

    reward = db.execute(select(Reward).where(Reward.id == reward_id, Reward.active.is_(True))).scalar_one_or_none()
    if not reward:
        raise AppError(400, "VALIDATION", "Recompensa no encontrada")

    if collaborator.points < reward.points_cost:
        raise AppError(400, "VALIDATION", "No tienes suficientes puntos")

    db.add(
        RewardRedemption(
            collaborator_id=collaborator.id,
            reward_id=reward_id,
            points_cost=reward.points_cost,
            created_at=now_utc(),
        )
    )
    if reward.stock > 0:
        reward.stock = reward.stock - 1

    new_total, new_level = _add_points(db, collaborator, -reward.points_cost)
    return {"redeemed": True, "new_total": new_total, "new_level": new_level}


def get_stats(db: Session):
    total_collaborators = db.execute(
        select(func.count()).select_from(Collaborator).where(Collaborator.active.is_(True))
    ).scalar_one()
    total_points = db.execute(
        select(func.coalesce(func.sum(Collaborator.points), 0)).where(Collaborator.active.is_(True))
    ).scalar_one()
    total_shares = db.execute(
        select(func.count()).select_from(CollaboratorActivity).where(
            CollaboratorActivity.type.in_(["INTERNAL_SHARE", "EXTERNAL_SHARE"])
        )
    ).scalar_one()
    return {
        "total_collaborators": total_collaborators,
        "total_points": total_points,
        "total_shares": total_shares,
    }
