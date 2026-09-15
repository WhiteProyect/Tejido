from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, cast, exists, func, or_, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import Category, Event, Favorite, Opportunity, Publication, User
from backend.service.schemas.publications import PublicationInput
from backend.service.services.serialization import row_to_dict, rows_to_dicts


def now_utc():
    return datetime.now(timezone.utc)


def list_publications(
    db: Session,
    user: Optional[dict],
    mine: Optional[str] = None,
    status: Optional[str] = None,
    kind: Optional[str] = None,
    search: Optional[str] = None,
):
    conditions = [Publication.deleted.is_(False)]
    wants_mine = mine == "1" and user
    wants_admin_status = status and user and user["role"] == "ADMIN"

    if wants_mine:
        conditions.append(Publication.author_id == user["id"])
    elif wants_admin_status:
        conditions.append(Publication.status == status)
    else:
        conditions.append(Publication.status == "PUBLISHED")

    if kind and kind != "TODOS":
        conditions.append(Publication.kind == kind)

    if search:
        term = f"%{search}%"
        conditions.append(
            or_(Publication.title.ilike(term), Publication.summary.ilike(term), Publication.location.ilike(term))
        )

    favorite_uid = user["id"] if user else -1
    favorite_expr = (
        exists(select(1).where(Favorite.publication_id == Publication.id, Favorite.user_id == favorite_uid))
        .label("favorite")
    )

    stmt = (
        select(Publication.__table__, Category.name.label("category"), Category.color.label("color"),
               User.name.label("author"), favorite_expr)
        .join(Category, Category.id == Publication.category_id)
        .join(User, User.id == Publication.author_id)
        .where(*conditions)
        .order_by(
            Publication.featured.desc(),
            # start_date es DateTime sin tz; created_at es TIMESTAMPTZ -- se
            # castea a DateTime (sin tz) para que COALESCE compare tipos
            # compatibles (Postgres no mezcla timestamp con/sin tz directo).
            func.coalesce(Publication.start_date, cast(Publication.created_at, DateTime)).desc(),
        )
    )
    return rows_to_dicts(db.execute(stmt).all())


def get_publication(db: Session, user: Optional[dict], publication_id: int):
    favorite_uid = user["id"] if user else -1
    favorite_expr = (
        exists(select(1).where(Favorite.publication_id == Publication.id, Favorite.user_id == favorite_uid))
        .label("favorite")
    )
    stmt = (
        select(Publication.__table__, Category.name.label("category"), Category.color.label("color"),
               User.name.label("author"), favorite_expr)
        .join(Category, Category.id == Publication.category_id)
        .join(User, User.id == Publication.author_id)
        .where(Publication.id == publication_id, Publication.deleted.is_(False))
    )
    return row_to_dict(db.execute(stmt).first())


def get_publication_owner_state(db: Session, publication_id: int):
    row = db.execute(
        select(Publication.id, Publication.status, Publication.author_id)
        .where(Publication.id == publication_id, Publication.deleted.is_(False))
    ).first()
    return row_to_dict(row)


def list_publication_images(db: Session, publication_id: int):
    from backend.service.models.tables import PublicationImage

    rows = db.execute(
        select(PublicationImage.id, PublicationImage.url, PublicationImage.alt_text,
               PublicationImage.caption, PublicationImage.position)
        .where(PublicationImage.publication_id == publication_id)
        .order_by(PublicationImage.position.asc())
    ).all()
    return rows_to_dicts(rows)


def validate_category(db: Session, category_id: int, kind: str):
    category = db.execute(
        select(Category.type).where(Category.id == category_id, Category.active.is_(True))
    ).first()
    if not category:
        raise AppError(400, "VALIDATION", "La categoría seleccionada no existe o está inactiva")
    if category[0] != kind:
        raise AppError(400, "VALIDATION", "La categoría no corresponde al tipo de publicación")


def _sync_publication_detail(db: Session, publication_id: int, item: PublicationInput):
    db.query(Event).filter(Event.publication_id == publication_id).delete()
    db.query(Opportunity).filter(Opportunity.publication_id == publication_id).delete()
    if item.kind == "EVENTO":
        db.add(Event(publication_id=publication_id, venue=item.location, capacity=None))
    elif item.kind == "OPORTUNIDAD":
        db.add(Opportunity(publication_id=publication_id, organization_name=None, deadline=item.end_date))


def create_publication(db: Session, user: dict, item: PublicationInput) -> int:
    validate_category(db, item.category_id, item.kind)
    image = item.image or "linear-gradient(135deg,#2F6B59,#F6C453)"
    status = "PUBLISHED" if user["role"] == "ADMIN" and item.publish else "DRAFT"
    ts = now_utc()
    publication = Publication(
        author_id=user["id"],
        category_id=item.category_id,
        kind=item.kind,
        title=item.title,
        summary=item.summary,
        content=item.content,
        image=image,
        location=item.location,
        start_date=item.start_date,
        end_date=item.end_date,
        link=item.link,
        featured=bool(item.featured) if user["role"] == "ADMIN" else False,
        status=status,
        created_at=ts,
        updated_at=ts,
    )
    db.add(publication)
    db.flush()
    _sync_publication_detail(db, publication.id, item)
    return publication.id


def update_publication(db: Session, publication_id: int, item: PublicationInput):
    db.query(Publication).filter(Publication.id == publication_id).update(
        {
            "category_id": item.category_id,
            "kind": item.kind,
            "title": item.title,
            "summary": item.summary,
            "content": item.content,
            "image": item.image,
            "location": item.location,
            "start_date": item.start_date,
            "end_date": item.end_date,
            "link": item.link,
            "status": "DRAFT",
            "moderation_note": None,
            "updated_at": now_utc(),
        }
    )
    _sync_publication_detail(db, publication_id, item)
