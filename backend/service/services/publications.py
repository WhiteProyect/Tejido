from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, cast, exists, func, or_, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import Category, Event, Favorite, Opportunity, Organization, Publication, Role, User
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS
from backend.service.schemas.publications import PublicationInput
from backend.service.services.org_profiles import visible_slug
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
    cultural_category: Optional[str] = None,
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

    if cultural_category:
        conditions.append(Publication.cultural_category == cultural_category)

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


def get_publication_detail(db: Session, user: Optional[dict], publication_id: int):
    """get_publication + lo que necesita la pagina de la publicacion (#publicacion/<id>): datos de
    su evento u oportunidad, la organizacion publica del autor (solo nombre, rama y foto, lo mismo
    que GET /api/gestores) y la galeria. Los permisos los resuelve la ruta."""
    row = get_publication(db, user, publication_id)
    if not row:
        return None
    extra = db.execute(
        select(Event.venue, Event.capacity, Opportunity.organization_name, Opportunity.deadline)
        .select_from(Publication)
        .join(Event, Event.publication_id == Publication.id, isouter=True)
        .join(Opportunity, Opportunity.publication_id == Publication.id, isouter=True)
        .where(Publication.id == publication_id)
    ).first()
    row.update(row_to_dict(extra))
    organization = db.execute(
        select(Organization.name, Organization.branch, Organization.photo_url)
        .where(Organization.user_id == row["author_id"], Organization.active.is_(True))
        .order_by(Organization.id)
        .limit(1)
    ).first()
    row["author_organization"] = row_to_dict(organization)
    # Enlace al perfil publico del autor (#gestor/<slug>) si es un gestor con perfil visible.
    row["author_slug"] = visible_slug(db, row["author_id"])
    row["images"] = list_publication_images(db, publication_id)
    return row


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


# ───────────────────────── categoria del gestor ─────────────────────────

STATUSES = ("DRAFT", "REVIEW", "REJECTED", "PUBLISHED")


def gestor_branch(db: Session, user_id: int) -> str | None:
    """Rama cultural del gestor (organizations.branch), solo si es una clave valida."""
    branch = db.execute(
        select(Organization.branch).where(Organization.user_id == user_id).order_by(Organization.id).limit(1)
    ).scalar_one_or_none()
    return branch if branch in CULTURAL_CATEGORIES else None


def resolve_cultural_category(db: Session, user: dict, requested: str | None) -> str | None:
    """Un GESTOR solo publica en su rama: vacia se le asigna, otra es 403, sin rama 409.
    El ADMIN elige cualquiera (o ninguna)."""
    if user["role"] != "GESTOR":
        return requested
    branch = gestor_branch(db, user["id"])
    if branch is None:
        raise AppError(409, "NO_CATEGORY", "Todavía no tienes una categoría asignada; escríbele al equipo de TEJIDO")
    if requested and requested != branch:
        raise AppError(403, "FORBIDDEN", f"Solo puedes publicar en tu categoría: {CULTURAL_CATEGORY_LABELS[branch]}")
    return branch


def status_after_edit(user: dict, current_status: str, publish: bool) -> tuple[str, bool]:
    """(nuevo estado, limpiar moderation_note) al editar. GESTOR autor: borrador/rechazada siguen
    en borrador; una publicada vuelve a revision (se oculta hasta que el admin la apruebe). ADMIN:
    conserva el estado, o la publica si pide publish. La ruta ya rechazo los casos no editables."""
    if user["role"] == "ADMIN":
        return ("PUBLISHED", True) if publish else (current_status, False)
    return ("REVIEW" if current_status == "PUBLISHED" else "DRAFT", True)


def category_overview(db: Session, user_id: int) -> dict:
    """GET /api/me/category: la categoria del gestor, sus conteos, sus colegas y lo publicado o en
    revision por otros autores de la misma categoria (nunca borradores ni rechazadas ajenas)."""
    organization = db.execute(
        select(Organization.name, Organization.photo_url).where(Organization.user_id == user_id).order_by(Organization.id).limit(1)
    ).first()
    counts = dict.fromkeys(STATUSES, 0)
    counts.update(dict(db.execute(
        select(Publication.status, func.count())
        .where(Publication.author_id == user_id, Publication.deleted.is_(False))
        .group_by(Publication.status)
    ).all()))
    branch = gestor_branch(db, user_id)
    result = {
        "branch": branch,
        "label": CULTURAL_CATEGORY_LABELS.get(branch),
        "organization": {"name": organization.name, "photo_url": organization.photo_url} if organization else None,
        "counts": counts,
        "colleagues": [],
        "others": [],
    }
    if branch is None:
        return result
    result["colleagues"] = rows_to_dicts(db.execute(
        select(Organization.id, Organization.name, Organization.photo_url)
        .join(User, User.id == Organization.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Organization.branch == branch, Organization.active.is_(True), User.active.is_(True),
               Role.name == "GESTOR", Organization.user_id != user_id)
        .order_by(Organization.name.asc(), Organization.id.asc())
    ).all())
    result["others"] = rows_to_dicts(db.execute(
        select(Publication.id, Publication.title, Publication.kind, Publication.status, User.name.label("author"),
               Publication.start_date, Publication.image)
        .join(User, User.id == Publication.author_id)
        .where(Publication.cultural_category == branch, Publication.author_id != user_id,
               Publication.deleted.is_(False), Publication.status.in_(("PUBLISHED", "REVIEW")))
        .order_by(Publication.updated_at.desc(), Publication.id.desc())
    ).all())
    return result


def _sync_publication_detail(db: Session, publication_id: int, item: PublicationInput):
    db.query(Event).filter(Event.publication_id == publication_id).delete()
    db.query(Opportunity).filter(Opportunity.publication_id == publication_id).delete()
    if item.kind == "EVENTO":
        db.add(Event(publication_id=publication_id, venue=item.location, capacity=None))
    elif item.kind == "OPORTUNIDAD":
        db.add(Opportunity(publication_id=publication_id, organization_name=None, deadline=item.end_date))


def create_publication(db: Session, user: dict, item: PublicationInput) -> int:
    validate_category(db, item.category_id, item.kind)
    cultural_category = resolve_cultural_category(db, user, item.cultural_category)
    image = item.image
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
        cultural_category=cultural_category,
        featured=bool(item.featured) if user["role"] == "ADMIN" else False,
        status=status,
        created_at=ts,
        updated_at=ts,
    )
    db.add(publication)
    db.flush()
    _sync_publication_detail(db, publication.id, item)
    return publication.id


def update_publication(db: Session, user: dict, publication_id: int, current_status: str, item: PublicationInput):
    cultural_category = resolve_cultural_category(db, user, item.cultural_category)
    status, clear_note = status_after_edit(user, current_status, item.publish)
    changes = {
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
        "cultural_category": cultural_category,
        "status": status,
        "updated_at": now_utc(),
    }
    if clear_note:
        changes["moderation_note"] = None
    db.query(Publication).filter(Publication.id == publication_id).update(changes)
    _sync_publication_detail(db, publication_id, item)
    return status
