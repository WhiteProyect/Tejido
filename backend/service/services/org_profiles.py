"""Perfil publico de los gestores (#gestor/<slug>): slug, lectura publica y edicion propia.

- El slug se asigna al crear la organizacion (ensure_slug, y como red de seguridad un
  before_flush para cualquier Organization nueva sin slug) y no cambia si cambia el nombre.
- Lo publico NUNCA incluye el correo del usuario, organizations.contact, user_id ni datos de
  moderacion; el contacto publico solo sale si su show_* esta activo.
- La edicion siempre es sobre la organizacion del usuario de la sesion.
"""
from datetime import date
from typing import Optional

from sqlalchemy import delete, event, func, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import (
    Organization, OrganizationHighlight, OrganizationImage, OrganizationSocialLink, Publication, Role, User,
)
from backend.service.schemas.artists import MAX_SLUG_LENGTH
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS
from backend.service.schemas.org_profiles import MAX_HIGHLIGHTS
from backend.service.services.artists import _with_suffix, slugify
from backend.service.services.organizations import NO_ORGANIZATION
from backend.service.services.serialization import rows_to_dicts

PROFILE_FIELDS = ("name", "description", "photo_url", "tagline", "cover_url", "founded_year", "municipality",
                  "has_venue", "address", "opening_hours", "map_url", "whatsapp", "public_email", "website",
                  "show_whatsapp", "show_public_email", "show_website", "seeking_text", "achievements")
MAX_TEAM = 12
MAX_PUBLICATIONS = 6


# ─────────────────────────── slug ───────────────────────────

def _slug_taken(db: Session, slug: str, exclude_id: Optional[int] = None) -> bool:
    stmt = select(Organization.id).where(func.lower(Organization.slug) == slug.lower())
    if exclude_id is not None:
        stmt = stmt.where(Organization.id != exclude_id)
    return db.execute(stmt.limit(1)).first() is not None


def generate_slug(db: Session, name: str, reserved=()) -> str:
    base = slugify(name or "")[:MAX_SLUG_LENGTH] or "gestor"
    if base.isdigit():
        base = f"gestor-{base}"
    return _with_suffix(base, lambda c: c in reserved or _slug_taken(db, c))


def ensure_slug(db: Session, org: Organization, reserved=()) -> str:
    """Asigna el slug si la organizacion aun no tiene (nunca lo cambia)."""
    if not org.slug:
        with db.no_autoflush:
            org.slug = generate_slug(db, org.name, reserved)
    return org.slug


@event.listens_for(Session, "before_flush")
def _assign_missing_slugs(session, flush_context, instances):
    pending = [obj for obj in session.new if isinstance(obj, Organization) and not obj.slug]
    reserved = {obj.slug for obj in session.new if isinstance(obj, Organization) and obj.slug}
    for org in pending:
        reserved.add(ensure_slug(session, org, reserved))


# ─────────────────────────── lectura ───────────────────────────

def _visible_condition():
    """Perfil visible: organizacion activa, usuario activo y no oculto por el admin."""
    return (Organization.active.is_(True), User.active.is_(True), Organization.profile_hidden.is_(False))


def _images(db: Session, org_id: int, highlight_id=None, all_highlights=False) -> list[dict]:
    query = select(OrganizationImage.id, OrganizationImage.highlight_id, OrganizationImage.url, OrganizationImage.alt_text,
                   OrganizationImage.caption, OrganizationImage.position).where(OrganizationImage.organization_id == org_id)
    if not all_highlights:
        query = query.where(OrganizationImage.highlight_id.is_(None) if highlight_id is None else OrganizationImage.highlight_id == highlight_id)
    return rows_to_dicts(db.execute(query.order_by(OrganizationImage.position, OrganizationImage.id)).all())


def _strip_image(image: dict) -> dict:
    return {k: image[k] for k in ("id", "url", "alt_text", "caption", "position")}


def _highlights(db: Session, org_id: int) -> list[dict]:
    rows = rows_to_dicts(db.execute(
        select(OrganizationHighlight.id, OrganizationHighlight.title, OrganizationHighlight.description,
               OrganizationHighlight.when_text, OrganizationHighlight.position)
        .where(OrganizationHighlight.organization_id == org_id)
        .order_by(OrganizationHighlight.position, OrganizationHighlight.id)
    ).all())
    images = [img for img in _images(db, org_id, all_highlights=True) if img["highlight_id"] is not None]
    for row in rows:
        row["images"] = [_strip_image(img) for img in images if img["highlight_id"] == row["id"]]
    return rows


def _social_links(db: Session, org_id: int) -> list[dict]:
    return rows_to_dicts(db.execute(
        select(OrganizationSocialLink.platform, OrganizationSocialLink.url, OrganizationSocialLink.label, OrganizationSocialLink.position)
        .where(OrganizationSocialLink.organization_id == org_id)
        .order_by(OrganizationSocialLink.position, OrganizationSocialLink.id)
    ).all())


def _member_row(db: Session, branch: str, leader: bool):
    """Gestores visibles de la rama (lider o participantes) para enlazar entre perfiles."""
    return (
        select(Organization.name, Organization.photo_url, Organization.slug)
        .join(User, User.id == Organization.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Organization.branch == branch, Organization.is_leader.is_(leader), Role.name == "GESTOR", *_visible_condition())
    )


def _build_profile(db: Session, org: Organization, user: User, private: bool) -> dict:
    branch = org.branch if org.branch in CULTURAL_CATEGORIES else None
    data = {
        "slug": org.slug, "name": org.name, "gestor_name": user.name, "photo_url": org.photo_url, "cover_url": org.cover_url,
        "tagline": org.tagline, "description": org.description, "branch": branch,
        "branch_label": CULTURAL_CATEGORY_LABELS.get(branch) if branch else None, "is_leader": bool(org.is_leader),
        "municipality": org.municipality, "founded_year": org.founded_year,
        "years_active": (date.today().year - org.founded_year) if org.founded_year else None,
        "has_venue": bool(org.has_venue),
        "social_links": _social_links(db, org.id),
        "highlights": _highlights(db, org.id),
        "gallery": [_strip_image(img) for img in _images(db, org.id)],
        "achievements": [line.strip() for line in (org.achievements or "").splitlines() if line.strip()],
    }
    if private:
        # Edicion propia: todos los campos, tal cual estan guardados.
        data.update({field: getattr(org, field) for field in PROFILE_FIELDS if field != "achievements"})
        data["achievements_text"] = org.achievements  # el texto tal cual (una por linea), para editarlo
        data["profile_hidden"] = bool(org.profile_hidden)
        data["seeking_text"] = org.seeking_text if org.is_leader else None
    else:
        if org.has_venue:
            data.update(address=org.address, opening_hours=org.opening_hours, map_url=org.map_url)
        data["contact"] = {
            "whatsapp": org.whatsapp if org.show_whatsapp else None,
            "public_email": org.public_email if org.show_public_email else None,
            "website": org.website if org.show_website else None,
        }
        data["seeking_text"] = org.seeking_text if org.is_leader else None

    data["publications"] = rows_to_dicts(db.execute(
        select(Publication.id, Publication.title, Publication.kind, Publication.image, Publication.start_date, Publication.summary)
        .where(Publication.author_id == user.id, Publication.status == "PUBLISHED", Publication.deleted.is_(False))
        .order_by(Publication.created_at.desc(), Publication.id.desc())
        .limit(MAX_PUBLICATIONS)
    ).all())

    if branch and org.is_leader:
        team = _member_row(db, branch, leader=False)
        data["team"] = rows_to_dicts(db.execute(team.order_by(Organization.name).limit(MAX_TEAM)).all())
        data["team_count"] = db.execute(select(func.count()).select_from(team.subquery())).scalar_one()
    elif branch:
        leader = db.execute(_member_row(db, branch, leader=True).limit(1)).first()
        data["leader"] = dict(leader._mapping) if leader else None
    return data


def public_profile(db: Session, slug: str) -> dict:
    row = db.execute(
        select(Organization, User)
        .join(User, User.id == Organization.user_id)
        .join(Role, Role.id == User.role_id)
        .where(func.lower(Organization.slug) == str(slug or "").strip().lower(), Role.name == "GESTOR", *_visible_condition())
        .limit(1)
    ).first()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Este perfil no está disponible")
    return _build_profile(db, row[0], row[1], private=False)


def preview_profile(db: Session, user_id: int) -> dict:
    """Vista previa del propio perfil (editor del gestor): EXACTAMENTE lo que ve el publico
    (misma serializacion), aunque el admin lo haya ocultado; profile_hidden avisa de eso."""
    org = own_organization(db, user_id)
    data = _build_profile(db, org, db.get(User, user_id), private=False)
    data["profile_hidden"] = bool(org.profile_hidden)
    return data


def visible_slug(db: Session, user_id: int) -> Optional[str]:
    """Slug del perfil del gestor si es publico (para enlazarlo desde una publicacion), o None."""
    return db.execute(
        select(Organization.slug)
        .join(User, User.id == Organization.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Organization.user_id == user_id, Role.name == "GESTOR", *_visible_condition())
        .order_by(Organization.id).limit(1)
    ).scalar_one_or_none()


# ─────────────────────────── edicion propia ───────────────────────────

def own_organization(db: Session, user_id: int) -> Organization:
    org = db.execute(
        select(Organization).where(Organization.user_id == user_id, Organization.active.is_(True)).order_by(Organization.id).limit(1)
    ).scalars().first()
    if org is None:
        raise AppError(404, "NOT_FOUND", NO_ORGANIZATION)
    return org


def own_profile(db: Session, user_id: int) -> dict:
    return _build_profile(db, own_organization(db, user_id), db.get(User, user_id), private=True)


def update_profile(db: Session, user_id: int, payload) -> dict:
    org = own_organization(db, user_id)
    for field in PROFILE_FIELDS:
        if field not in payload.model_fields_set:
            continue
        if field == "seeking_text" and not org.is_leader:
            continue  # solo el lider tiene "buscamos"
        value = getattr(payload, field)
        if field == "name" and value is None:
            continue
        if field in ("has_venue", "show_whatsapp", "show_public_email", "show_website") and value is None:
            continue
        setattr(org, field, value)
    db.flush()
    return own_profile(db, user_id)


def _replace_images(db: Session, org_id: int, highlight_id: Optional[int], images) -> None:
    db.execute(delete(OrganizationImage).where(
        OrganizationImage.organization_id == org_id,
        OrganizationImage.highlight_id.is_(None) if highlight_id is None else OrganizationImage.highlight_id == highlight_id,
    ))
    for position, image in enumerate(images):
        db.add(OrganizationImage(organization_id=org_id, highlight_id=highlight_id, url=image.url,
                                 alt_text=image.alt_text, caption=image.caption, position=position))


def replace_social_links(db: Session, user_id: int, links) -> list[dict]:
    org = own_organization(db, user_id)
    db.execute(delete(OrganizationSocialLink).where(OrganizationSocialLink.organization_id == org.id))
    for position, link in enumerate(links):
        db.add(OrganizationSocialLink(organization_id=org.id, platform=link.platform, url=link.url,
                                      label=link.label if link.platform == "otro" else None, position=position))
    db.flush()
    return _social_links(db, org.id)


def replace_gallery(db: Session, user_id: int, images) -> list[dict]:
    org = own_organization(db, user_id)
    _replace_images(db, org.id, None, images)
    db.flush()
    return [_strip_image(img) for img in _images(db, org.id)]


def _own_highlight(db: Session, org_id: int, highlight_id: int) -> OrganizationHighlight:
    highlight = db.get(OrganizationHighlight, highlight_id)
    if highlight is None or highlight.organization_id != org_id:
        raise AppError(404, "NOT_FOUND", "Esa manifestación no existe")
    return highlight


def _highlight_dict(db: Session, org_id: int, highlight_id: int) -> dict:
    return next(h for h in _highlights(db, org_id) if h["id"] == highlight_id)


def create_highlight(db: Session, user_id: int, payload) -> dict:
    org = own_organization(db, user_id)
    if payload.title is None:
        raise AppError(400, "VALIDATION", "El título es requerido")
    count = db.execute(select(func.count()).select_from(OrganizationHighlight).where(OrganizationHighlight.organization_id == org.id)).scalar_one()
    if count >= MAX_HIGHLIGHTS:
        raise AppError(409, "LIMIT", f"Máximo {MAX_HIGHLIGHTS} manifestaciones culturales")
    highlight = OrganizationHighlight(organization_id=org.id, title=payload.title, description=payload.description,
                                      when_text=payload.when_text, position=payload.position if payload.position is not None else count)
    db.add(highlight)
    db.flush()
    _replace_images(db, org.id, highlight.id, payload.images or [])
    db.flush()
    return _highlight_dict(db, org.id, highlight.id)


def update_highlight(db: Session, user_id: int, highlight_id: int, payload) -> dict:
    org = own_organization(db, user_id)
    highlight = _own_highlight(db, org.id, highlight_id)
    sent = payload.model_fields_set
    if "title" in sent and payload.title is not None:
        highlight.title = payload.title
    for field in ("description", "when_text"):
        if field in sent:
            setattr(highlight, field, getattr(payload, field))
    if "position" in sent and payload.position is not None:
        highlight.position = payload.position
    if "images" in sent and payload.images is not None:
        _replace_images(db, org.id, highlight.id, payload.images)
    db.flush()
    return _highlight_dict(db, org.id, highlight.id)


def delete_highlight(db: Session, user_id: int, highlight_id: int) -> None:
    org = own_organization(db, user_id)
    db.delete(_own_highlight(db, org.id, highlight_id))
    db.flush()
