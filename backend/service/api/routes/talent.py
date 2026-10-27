"""Talento contratable (services/talent.py).

Publico (sesion opcional, solo para `favorite`): GET /api/talent y GET /api/talent/{slug}, solo lo PUBLISHED.
Guardar (solo CIUDADANO): POST/DELETE /api/talent/{id}/favorite.
Gestion: ADMIN (todo) y el LIDER de la rama (solo su rama); los permisos y la rama salen de la
base. Las rutas /api/talent/manage van antes que /api/talent/{slug} para que "manage" no se lea
como slug (ademas es un slug reservado).
"""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user
from backend.service.db.session import get_db
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORY_LABELS
from backend.service.schemas.talent import (
    AvailabilityInput, EndorsementsInput, MediaListInput, MilestonesInput, ServicesInput, SpecsInput, TalentCreateInput,
    TalentStatusInput, TalentUpdateInput, VenuesInput,
)
from backend.service.services import notifications
from backend.service.services import talent as svc

router = APIRouter(prefix="/api/talent")


def _notify_review(background_tasks: BackgroundTasks, profile, user: dict) -> None:
    background_tasks.add_task(notifications.notify_talent_review, profile.name, user["name"],
                              CULTURAL_CATEGORY_LABELS.get(profile.category, profile.category))


# ─────────────────────────── gestion ───────────────────────────

@router.get("/manage")
def list_manage(status: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None,
                user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_manage(db, user, status=status, category=category, q=q)


@router.get("/manage/{talent_id}")
def manage_detail(talent_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.manage_detail(db, user, talent_id)


@router.post("", status_code=201)
def create_talent(payload: TalentCreateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = svc.create(db, user, payload)
    return {"id": profile.id, "slug": profile.slug}


@router.patch("/{talent_id}")
def update_talent(talent_id: int, payload: TalentUpdateInput, background_tasks: BackgroundTasks,
                  user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    profile, to_review = svc.update(db, user, talent_id, payload)
    result = svc.manage_detail(db, user, talent_id)
    if to_review:
        # Commit antes del aviso: el correo solo sale con el cambio ya guardado.
        db.commit()
        _notify_review(background_tasks, profile, user)
    return result


def _put_list(key: str, talent_id: int, items: list, background_tasks: BackgroundTasks, user, db: Session) -> dict:
    saved, profile, to_review = svc.replace_children(db, user, talent_id, key, items)
    result = {"items": saved, "status": profile.status}
    if to_review:
        db.commit()
        _notify_review(background_tasks, profile, user)
    return result


@router.put("/{talent_id}/services")
def put_services(talent_id: int, payload: ServicesInput, background_tasks: BackgroundTasks,
                 user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return _put_list("services", talent_id, payload.items, background_tasks, user, db)


@router.put("/{talent_id}/specs")
def put_specs(talent_id: int, payload: SpecsInput, background_tasks: BackgroundTasks,
              user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return _put_list("specs", talent_id, payload.items, background_tasks, user, db)


@router.put("/{talent_id}/media")
def put_media(talent_id: int, payload: MediaListInput, background_tasks: BackgroundTasks,
              user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return _put_list("media", talent_id, payload.items, background_tasks, user, db)


@router.put("/{talent_id}/milestones")
def put_milestones(talent_id: int, payload: MilestonesInput, background_tasks: BackgroundTasks,
                   user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return _put_list("milestones", talent_id, payload.items, background_tasks, user, db)


@router.put("/{talent_id}/endorsements")
def put_endorsements(talent_id: int, payload: EndorsementsInput, background_tasks: BackgroundTasks,
                     user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return _put_list("endorsements", talent_id, payload.items, background_tasks, user, db)


@router.put("/{talent_id}/venues")
def put_venues(talent_id: int, payload: VenuesInput, background_tasks: BackgroundTasks,
               user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return _put_list("venues", talent_id, payload.items, background_tasks, user, db)


@router.put("/{talent_id}/availability")
def put_availability(talent_id: int, payload: AvailabilityInput, user: Optional[dict] = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    return {"days": svc.replace_availability(db, user, talent_id, payload)}


@router.post("/{talent_id}/submit")
def submit_talent(talent_id: int, background_tasks: BackgroundTasks, user: Optional[dict] = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    profile = svc.submit(db, user, talent_id)
    db.commit()
    _notify_review(background_tasks, profile, user)
    return {"id": profile.id, "status": profile.status}


@router.patch("/{talent_id}/status")
def moderate_talent(talent_id: int, payload: TalentStatusInput, background_tasks: BackgroundTasks,
                    user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = svc.moderate(db, user, talent_id, payload.status, payload.note)
    creator = svc.creator_contact(db, profile)
    result = {"id": profile.id, "status": profile.status, "published_at": profile.published_at}
    db.commit()
    if creator:
        background_tasks.add_task(notifications.notify_talent_decision, creator.email, creator.name, profile.name,
                                  profile.status, profile.moderation_note)
    return result


@router.delete("/{talent_id}")
def delete_talent(talent_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.soft_delete(db, user, talent_id)
    return {"ok": True}


@router.post("/{talent_id}/favorite")
def add_favorite(talent_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.add_favorite(db, user, talent_id)
    return {"favorite": True}


@router.delete("/{talent_id}/favorite")
def remove_favorite(talent_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.remove_favorite(db, user, talent_id)
    return {"favorite": False}


# ─────────────────────────── publico ───────────────────────────

@router.get("")
def list_talent(category: Optional[str] = None, origin: Optional[str] = None, q: Optional[str] = None,
                available: bool = False, limit: int = Query(default=svc.DEFAULT_LIMIT, ge=1, le=svc.MAX_LIMIT),
                offset: int = Query(default=0, ge=0), user: Optional[dict] = Depends(get_current_user),
                db: Session = Depends(get_db)):
    return svc.list_public(db, category=category, origin=origin, q=q, available=available, limit=limit, offset=offset,
                           user=user)


@router.get("/{slug}")
def get_talent(slug: str, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.public_profile(db, slug, user)
