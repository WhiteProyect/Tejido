"""Talento contratable (portafolios de contratacion artistica): lectura publica y gestion.

- Lo publico solo ve perfiles PUBLISHED y no borrados, y NUNCA incluye created_by, correos,
  ids de usuario ni la nota de moderacion; el representante sale como {name, slug} de su
  perfil publico de gestor, y solo si ese perfil es visible.
- Gestionan el ADMIN (todas las ramas) y el LIDER de la rama (solo perfiles de su rama, que
  es la categoria del perfil). La rama siempre sale de la base (services/branches.py).
- Ciclo: DRAFT -> REVIEW (el lider lo envia) -> PUBLISHED | REJECTED (solo el admin). El
  lider que edita algo publicado lo devuelve a REVIEW (un solo aviso al equipo); en REVIEW puede
  seguir editando (el editor guarda por secciones) y el perfil se queda en REVIEW.
- La disponibilidad es informacion operativa: editarla no cambia el estado del perfil.
- Solo el CIUDADANO guarda talento (talent_favorites); `favorite` sale en tarjetas y perfil.
"""
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, delete, exists, func, select
from sqlalchemy.orm import Session

from backend.service.api.deps import require_verified
from backend.service.errors import AppError
from backend.service.models.tables import (
    Organization, Role, TalentAvailability, TalentEndorsement, TalentFavorite, TalentMedia, TalentMilestone, TalentProfile,
    TalentService, TalentSpec, TalentVenue, User,
)
from backend.service.schemas.artists import MAX_SLUG_LENGTH
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS
from backend.service.schemas.municipalities import MUNICIPALITIES, MUNICIPALITY_LABELS
from backend.service.schemas.talent import (
    ADMIN_ONLY_FIELDS, AVAILABILITY_WINDOW_DAYS, NOT_EDITABLE_FIELDS, RESERVED_TALENT_SLUGS, STATUSES, AvailabilityInput,
    TalentCreateInput, TalentUpdateInput, today_co,
)
from backend.service.services.artists import _with_suffix, slugify
from backend.service.services.branches import leader_of, participant_branch

PUBLIC_DAYS = 180
MAX_TAGS = 3
MAX_SIMILAR = 3
DEFAULT_LIMIT = 24
MAX_LIMIT = 60
MANAGERS_ONLY = "Solo un administrador o el líder de una rama pueden gestionar talento"
OTHER_BRANCH = "Este talento es de otra rama: solo lo gestionan su líder o un administrador"

# translate() de Postgres para buscar sin tildes ni mayusculas (sin depender de la extension unaccent).
_ACCENTED = "áàäâéèëêíìïîóòöôúùüûñ"
_PLAIN = "aaaaeeeeiiiioooouuuun"

PUBLIC_ORDER = (TalentProfile.featured.desc(), TalentProfile.verified.desc(), func.lower(TalentProfile.name), TalentProfile.id)

# (modelo, columnas en orden) de cada lista que se reemplaza entera con PUT.
CHILDREN = {
    "services": (TalentService, ("title", "tag", "description", "price", "price_note")),
    "specs": (TalentSpec, ("label", "value")),
    "media": (TalentMedia, ("type", "url", "thumbnail_url", "title", "caption")),
    "milestones": (TalentMilestone, ("year", "title", "description")),
    "endorsements": (TalentEndorsement, ("kind", "title", "text", "rating")),
    "venues": (TalentVenue, ("name", "municipality")),
}


def now_utc():
    return datetime.now(timezone.utc)


# ─────────────────────────── slug ───────────────────────────

def _slug_taken(db: Session, slug: str, exclude_id: Optional[int] = None) -> bool:
    stmt = select(TalentProfile.id).where(func.lower(TalentProfile.slug) == slug.lower())
    if exclude_id is not None:
        stmt = stmt.where(TalentProfile.id != exclude_id)
    return db.execute(stmt.limit(1)).first() is not None


def generate_slug(db: Session, name: str) -> str:
    """Desde el nombre, con -2, -3... si choca; nunca solo numeros ni reservado. Incluye los borrados."""
    base = slugify(name or "")[:MAX_SLUG_LENGTH] or "talento"
    if base.isdigit():
        base = f"talento-{base}"
    return _with_suffix(base, lambda c: c in RESERVED_TALENT_SLUGS or _slug_taken(db, c))


# ─────────────────────────── lectura publica ───────────────────────────

def _fold(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower()


def _folded(column):
    return func.translate(func.lower(column), _ACCENTED, _PLAIN)


def _search_condition(q: str):
    term = _fold(q.strip()).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{term}%"
    return _folded(TalentProfile.name).like(pattern, escape="\\") | _folded(func.coalesce(TalentProfile.tagline, "")).like(pattern, escape="\\")


def _available_condition(today):
    return exists().where(TalentAvailability.talent_id == TalentProfile.id, TalentAvailability.state == "AVAILABLE",
                          TalentAvailability.day >= today)


def _visible():
    return (TalentProfile.status == "PUBLISHED", TalentProfile.deleted.is_(False))


def _labels(profile: TalentProfile) -> dict:
    return {"category_label": CULTURAL_CATEGORY_LABELS.get(profile.category),
            "origin_label": MUNICIPALITY_LABELS.get(profile.origin)}


def _card_extras(db: Session, ids: list[int]) -> dict:
    """tags (hasta 3 distintas, en el orden de los servicios), price_from y next_available por perfil."""
    extras = {talent_id: {"tags": [], "price_from": None, "next_available": None} for talent_id in ids}
    if not ids:
        return extras
    for talent_id, tag in db.execute(
        select(TalentService.talent_id, TalentService.tag)
        .where(TalentService.talent_id.in_(ids), TalentService.tag.is_not(None))
        .order_by(TalentService.talent_id, TalentService.position, TalentService.id)
    ).all():
        tags = extras[talent_id]["tags"]
        if len(tags) < MAX_TAGS and tag.lower() not in {t.lower() for t in tags}:
            tags.append(tag)
    for talent_id, price in db.execute(
        select(TalentService.talent_id, func.min(TalentService.price))
        .where(TalentService.talent_id.in_(ids), TalentService.price.is_not(None))
        .group_by(TalentService.talent_id)
    ).all():
        extras[talent_id]["price_from"] = price
    for talent_id, day in db.execute(
        select(TalentAvailability.talent_id, func.min(TalentAvailability.day))
        .where(TalentAvailability.talent_id.in_(ids), TalentAvailability.state == "AVAILABLE", TalentAvailability.day >= today_co())
        .group_by(TalentAvailability.talent_id)
    ).all():
        extras[talent_id]["next_available"] = day
    return extras


def _favorite_ids(db: Session, user: Optional[dict], ids: list[int]) -> set[int]:
    if not ids or not user or user["role"] != "CIUDADANO":
        return set()
    return set(db.execute(
        select(TalentFavorite.talent_id).where(TalentFavorite.user_id == user["id"], TalentFavorite.talent_id.in_(ids))
    ).scalars().all())


def _cards(db: Session, profiles: list[TalentProfile], user: Optional[dict] = None) -> list[dict]:
    ids = [p.id for p in profiles]
    extras = _card_extras(db, ids)
    favorites = _favorite_ids(db, user, ids)
    return [{
        "id": p.id, "slug": p.slug, "name": p.name, "category": p.category, "origin": p.origin, **_labels(p),
        "tagline": p.tagline, "cover_url": p.cover_url, "verified": bool(p.verified), "act_number": p.act_number,
        **extras[p.id], "favorite": p.id in favorites,
    } for p in profiles]


def _filter_value(value: Optional[str], valid, label: str, upper: bool) -> Optional[str]:
    value = str(value or "").strip()
    if not value:
        return None
    value = value.upper() if upper else value.lower()
    if value not in valid:
        raise AppError(400, "VALIDATION", f"{label} no válido")
    return value


def list_public(db: Session, category=None, origin=None, q=None, available=False, limit=DEFAULT_LIMIT, offset=0,
                user: Optional[dict] = None) -> dict:
    category = _filter_value(category, CULTURAL_CATEGORIES, "Categoría", upper=True)
    origin = _filter_value(origin, MUNICIPALITIES, "Municipio", upper=False)
    q = str(q or "").strip()[:100]
    filters = {}
    if category:
        filters["category"] = TalentProfile.category == category
    if origin:
        filters["origin"] = TalentProfile.origin == origin
    if q:
        filters["q"] = _search_condition(q)
    if available:
        filters["available"] = _available_condition(today_co())

    def conditions(*skip):
        return (*_visible(), *(cond for key, cond in filters.items() if key not in skip))

    profiles = db.execute(
        select(TalentProfile).where(*conditions()).order_by(*PUBLIC_ORDER).limit(limit).offset(offset)
    ).scalars().all()
    total = db.execute(select(func.count()).select_from(TalentProfile).where(*conditions())).scalar_one()
    # Cada faceta se cuenta con los OTROS filtros: asi se ve cuanto hay en cada opcion alternativa.
    categories = dict.fromkeys(CULTURAL_CATEGORY_LABELS, 0)
    categories.update(dict(db.execute(
        select(TalentProfile.category, func.count()).where(*conditions("category")).group_by(TalentProfile.category)
    ).all()))
    origins = dict.fromkeys(MUNICIPALITY_LABELS, 0)
    origins.update(dict(db.execute(
        select(TalentProfile.origin, func.count()).where(*conditions("origin")).group_by(TalentProfile.origin)
    ).all()))
    return {"items": _cards(db, profiles, user), "total": total, "facets": {"categories": categories, "origins": origins}}


def _children(db: Session, talent_id: int) -> dict:
    result = {}
    for key, (model, columns) in CHILDREN.items():
        rows = db.execute(
            select(*(getattr(model, column) for column in columns))
            .where(model.talent_id == talent_id).order_by(model.position, model.id)
        ).all()
        result[key] = [dict(zip(columns, row)) for row in rows]
    return result


def _availability(db: Session, talent_id: int, start, end) -> list[dict]:
    rows = db.execute(
        select(TalentAvailability.day, TalentAvailability.state)
        .where(TalentAvailability.talent_id == talent_id, TalentAvailability.day >= start, TalentAvailability.day <= end)
        .order_by(TalentAvailability.day)
    ).all()
    return [{"day": day, "state": state} for day, state in rows]


def _public_representative(db: Session, user_id: Optional[int]) -> Optional[dict]:
    """{name, slug} del perfil publico del gestor si es visible (mismas reglas que #gestor/<slug>)."""
    if user_id is None:
        return None
    row = db.execute(
        select(Organization.name, Organization.slug)
        .join(User, User.id == Organization.user_id)
        .join(Role, Role.id == User.role_id)
        .where(Organization.user_id == user_id, Role.name == "GESTOR", Organization.active.is_(True), User.active.is_(True),
               Organization.profile_hidden.is_(False))
        .order_by(Organization.id).limit(1)
    ).first()
    return {"name": row.name, "slug": row.slug} if row else None


def _core(profile: TalentProfile) -> dict:
    return {
        "id": profile.id, "slug": profile.slug, "name": profile.name, "category": profile.category, "origin": profile.origin,
        **_labels(profile), "tagline": profile.tagline, "description": profile.description, "cover_url": profile.cover_url,
        "verified": bool(profile.verified), "act_number": profile.act_number, "act_date": profile.act_date,
        "featured": bool(profile.featured), "published_at": profile.published_at,
    }


def public_profile(db: Session, slug: str, user: Optional[dict] = None) -> dict:
    profile = db.execute(
        select(TalentProfile).where(func.lower(TalentProfile.slug) == str(slug or "").strip().lower(), *_visible())
    ).scalars().first()
    if profile is None:
        raise AppError(404, "NOT_FOUND", "Talento no encontrado")
    today = today_co()
    extras = _card_extras(db, [profile.id])[profile.id]
    similar = db.execute(
        select(TalentProfile).where(*_visible(), TalentProfile.category == profile.category, TalentProfile.id != profile.id)
        # Primero los del mismo municipio de origen ("talento parecido cerca de aqui").
        .order_by((TalentProfile.origin == profile.origin).desc(), *PUBLIC_ORDER).limit(MAX_SIMILAR)
    ).scalars().all()
    return {
        **_core(profile), **_children(db, profile.id),
        "availability": _availability(db, profile.id, today, today + timedelta(days=PUBLIC_DAYS)),
        "next_available": extras["next_available"], "price_from": extras["price_from"],
        "representative": _public_representative(db, profile.representative_user_id),
        "similar": _cards(db, similar, user),
        "favorite": bool(_favorite_ids(db, user, [profile.id])),
    }


# ─────────────────────────── permisos ───────────────────────────

def manager_branch(db: Session, user: Optional[dict]) -> Optional[str]:
    """None si es ADMIN (todas las ramas); la rama si es el lider; cualquier otro, 403."""
    if not user:
        raise AppError(401, "UNAUTHORIZED", "Inicia sesión para gestionar talento")
    if user["role"] == "ADMIN":
        return None
    branch = leader_of(db, user["id"]) if user["role"] == "GESTOR" else None
    if branch is None:
        raise AppError(403, "FORBIDDEN", MANAGERS_ONLY)
    return branch


def _load(db: Session, talent_id: int) -> TalentProfile:
    profile = db.execute(
        select(TalentProfile).where(TalentProfile.id == talent_id, TalentProfile.deleted.is_(False))
    ).scalars().first()
    if profile is None:
        raise AppError(404, "NOT_FOUND", "Talento no encontrado")
    return profile


def load_for_manager(db: Session, user: Optional[dict], talent_id: int) -> tuple[TalentProfile, Optional[str]]:
    branch = manager_branch(db, user)
    profile = _load(db, talent_id)
    if branch is not None and profile.category != branch:
        raise AppError(403, "FORBIDDEN", OTHER_BRANCH)
    return profile, branch


def _check_representative(db: Session, user: dict, branch: Optional[str], rep_id: Optional[int]) -> None:
    """Lider: el mismo o un participante activo de su rama. Admin: cualquier gestor activo."""
    if rep_id is None:
        return
    row = db.execute(
        select(User.active, Role.name).join(Role, Role.id == User.role_id).where(User.id == rep_id)
    ).first()
    if row is None or not row.active or row.name != "GESTOR":
        raise AppError(400, "VALIDATION", "El representante debe ser un gestor activo")
    if branch is not None and rep_id != user["id"] and participant_branch(db, rep_id) != branch:
        raise AppError(403, "FORBIDDEN", "Como líder solo puedes elegirte a ti o a un participante activo de tu rama")


def _check_fields(user: dict, branch: Optional[str], payload) -> set:
    sent = set(payload.model_fields_set)
    if branch is not None:
        blocked = [field for field in ADMIN_ONLY_FIELDS if field in sent]
        if payload.publish:
            blocked.append("publish")
        if blocked:
            raise AppError(403, "FORBIDDEN", f"Solo un administrador puede cambiar: {', '.join(blocked)}")
    else:
        blocked = [field for field in NOT_EDITABLE_FIELDS if field in sent]
        if blocked:
            raise AppError(400, "VALIDATION", f"No se cambia por aquí: {', '.join(blocked)} (el estado va por publicar, enviar o moderar)")
    for field, label in (("name", "El nombre"), ("category", "La categoría"), ("origin", "El municipio de origen")):
        if field in sent and getattr(payload, field) is None:
            raise AppError(400, "VALIDATION", f"{label} es requerido")
    return sent


def _check_verified(profile: TalentProfile) -> None:
    # Antes que el CHECK de la base, para devolver un 400 claro y no un error de integridad.
    if profile.verified and not profile.act_number:
        raise AppError(400, "VALIDATION", "Para marcarlo como verificado escribe el número del acta")


def _publish(profile: TalentProfile, now) -> None:
    profile.status = "PUBLISHED"
    profile.moderation_note = None
    if profile.published_at is None:
        profile.published_at = now


def _after_edit(user: dict, profile: TalentProfile, publish: bool = False) -> bool:
    """Estado tras editar. Devuelve True si un lider devolvio a revision algo publicado (aviso al equipo)."""
    now = now_utc()
    profile.updated_at = now
    if user["role"] == "ADMIN":
        if publish:
            _publish(profile, now)
        return False
    if profile.status == "REVIEW":
        return False
    to_review = profile.status == "PUBLISHED"
    profile.status = "REVIEW" if to_review else "DRAFT"
    profile.moderation_note = None
    return to_review


# ─────────────────────────── gestion ───────────────────────────

def _private(db: Session, profile: TalentProfile) -> dict:
    representative = None
    if profile.representative_user_id is not None:
        rep = db.execute(select(User.id, User.name).where(User.id == profile.representative_user_id)).first()
        representative = {"id": rep.id, "name": rep.name} if rep else None
    return {
        **_core(profile), "status": profile.status, "moderation_note": profile.moderation_note,
        "representative_user_id": profile.representative_user_id, "representative": representative,
        "created_at": profile.created_at, "updated_at": profile.updated_at,
    }


def list_manage(db: Session, user: Optional[dict], status=None, category=None, q=None) -> dict:
    branch = manager_branch(db, user)
    status = _filter_value(status, STATUSES, "Estado", upper=True)
    category = _filter_value(category, CULTURAL_CATEGORIES, "Categoría", upper=True)
    conditions = [TalentProfile.deleted.is_(False)]
    if branch is not None:
        conditions.append(TalentProfile.category == branch)
    if category:
        conditions.append(TalentProfile.category == category)
    if status:
        conditions.append(TalentProfile.status == status)
    q = str(q or "").strip()[:100]
    if q:
        conditions.append(_search_condition(q))
    profiles = db.execute(
        select(TalentProfile).where(*conditions).order_by(TalentProfile.updated_at.desc(), TalentProfile.id.desc())
    ).scalars().all()
    extras = _card_extras(db, [p.id for p in profiles])
    items = [{**_private(db, p), "tags": extras[p.id]["tags"], "price_from": extras[p.id]["price_from"],
              "next_available": extras[p.id]["next_available"]} for p in profiles]
    return {"items": items, "branch": branch}


def manage_detail(db: Session, user: Optional[dict], talent_id: int) -> dict:
    profile, _ = load_for_manager(db, user, talent_id)
    today = today_co()
    return {
        **_private(db, profile), **_children(db, profile.id),
        "availability": _availability(db, profile.id, today, today + timedelta(days=AVAILABILITY_WINDOW_DAYS)),
    }


def create(db: Session, user: Optional[dict], payload: TalentCreateInput) -> TalentProfile:
    branch = manager_branch(db, user)
    _check_fields(user, branch, payload)
    category = payload.category
    if branch is not None:
        # El lider solo crea en su rama: sin categoria se usa la suya; otra distinta, 403.
        if category is not None and category != branch:
            raise AppError(403, "FORBIDDEN", "Como líder solo puedes crear talento de tu rama")
        category = branch
    elif category is None:
        raise AppError(400, "VALIDATION", "La categoría es requerida")
    _check_representative(db, user, branch, payload.representative_user_id)
    if payload.slug is not None and _slug_taken(db, payload.slug):
        raise AppError(409, "SLUG_TAKEN", "Ese slug ya está en uso")
    now = now_utc()
    profile = TalentProfile(
        slug=payload.slug or generate_slug(db, payload.name), name=payload.name, category=category, origin=payload.origin,
        tagline=payload.tagline, description=payload.description, cover_url=payload.cover_url,
        representative_user_id=payload.representative_user_id, created_by=user["id"], status="DRAFT",
        verified=bool(payload.verified), act_number=payload.act_number, act_date=payload.act_date,
        featured=bool(payload.featured), deleted=False, created_at=now, updated_at=now,
    )
    _check_verified(profile)
    if payload.publish:
        _publish(profile, now)
    db.add(profile)
    db.flush()
    return profile


def update(db: Session, user: Optional[dict], talent_id: int, payload: TalentUpdateInput) -> tuple[TalentProfile, bool]:
    profile, branch = load_for_manager(db, user, talent_id)
    sent = _check_fields(user, branch, payload)
    if branch is not None and "category" in sent and payload.category != branch:
        raise AppError(403, "FORBIDDEN", "Como líder no puedes pasar este talento a otra rama")
    if "representative_user_id" in sent:
        _check_representative(db, user, branch, payload.representative_user_id)
    if "slug" in sent and payload.slug is not None and payload.slug != profile.slug:
        if _slug_taken(db, payload.slug, exclude_id=profile.id):
            raise AppError(409, "SLUG_TAKEN", "Ese slug ya está en uso")
        profile.slug = payload.slug
    for field in ("name", "category", "origin", "tagline", "description", "cover_url", "representative_user_id",
                  "act_number", "act_date"):
        if field in sent:
            setattr(profile, field, getattr(payload, field))
    for field in ("verified", "featured"):
        if field in sent and getattr(payload, field) is not None:
            setattr(profile, field, getattr(payload, field))
    _check_verified(profile)
    to_review = _after_edit(user, profile, payload.publish)
    db.flush()
    return profile, to_review


def replace_children(db: Session, user: Optional[dict], talent_id: int, key: str, items: list) -> tuple[list[dict], TalentProfile, bool]:
    profile, _ = load_for_manager(db, user, talent_id)
    model, columns = CHILDREN[key]
    db.execute(delete(model).where(model.talent_id == profile.id))
    for position, item in enumerate(items):
        db.add(model(talent_id=profile.id, position=position, **{column: getattr(item, column) for column in columns}))
    to_review = _after_edit(user, profile)
    db.flush()
    return _children(db, profile.id)[key], profile, to_review


def replace_availability(db: Session, user: Optional[dict], talent_id: int, payload: AvailabilityInput) -> list[dict]:
    profile, _ = load_for_manager(db, user, talent_id)
    db.execute(delete(TalentAvailability).where(
        TalentAvailability.talent_id == profile.id,
        and_(TalentAvailability.day >= payload.from_day, TalentAvailability.day <= payload.to_day),
    ))
    for item in payload.days:
        db.add(TalentAvailability(talent_id=profile.id, day=item.day, state=item.state))
    profile.updated_at = now_utc()
    db.flush()
    return _availability(db, profile.id, payload.from_day, payload.to_day)


def missing_for_review(db: Session, profile: TalentProfile) -> list[str]:
    missing = [label for value, label in (
        (profile.name, "nombre"), (profile.category, "categoría"), (profile.origin, "municipio de origen"),
        (profile.tagline, "frase de presentación"), (profile.cover_url, "foto de portada"),
    ) if not value]
    has_service = db.execute(select(TalentService.id).where(TalentService.talent_id == profile.id).limit(1)).first()
    if not has_service:
        missing.append("al menos un servicio")
    return missing


def submit(db: Session, user: Optional[dict], talent_id: int) -> TalentProfile:
    profile, branch = load_for_manager(db, user, talent_id)
    if branch is None:
        raise AppError(403, "FORBIDDEN", "El administrador no envía a revisión: puede publicar directo")
    if profile.status not in ("DRAFT", "REJECTED"):
        raise AppError(409, "INVALID_STATE", "Solo un borrador o un talento rechazado puede enviarse a revisión")
    missing = missing_for_review(db, profile)
    if missing:
        raise AppError(400, "VALIDATION", f"Para enviarlo a revisión falta: {', '.join(missing)}")
    profile.status = "REVIEW"
    profile.moderation_note = None
    profile.updated_at = now_utc()
    db.flush()
    return profile


def moderate(db: Session, user: Optional[dict], talent_id: int, status: str, note: str) -> TalentProfile:
    if not user:
        raise AppError(401, "UNAUTHORIZED", "Inicia sesión para moderar")
    if user["role"] != "ADMIN":
        raise AppError(403, "FORBIDDEN", "Solo un administrador puede aprobar o rechazar talento")
    if status not in ("PUBLISHED", "REJECTED"):
        raise AppError(400, "VALIDATION", "Solo se puede aprobar (PUBLISHED) o rechazar (REJECTED)")
    if status == "REJECTED" and len(note) < 5:
        raise AppError(400, "VALIDATION", "Escribe un motivo de rechazo claro")
    profile = _load(db, talent_id)
    if profile.status != "REVIEW":
        raise AppError(409, "INVALID_STATE", "Solo se puede moderar un talento que esté en revisión")
    now = now_utc()
    if status == "PUBLISHED":
        _publish(profile, now)
    else:
        profile.status = "REJECTED"
        profile.moderation_note = note
    profile.updated_at = now
    db.flush()
    return profile


def soft_delete(db: Session, user: Optional[dict], talent_id: int) -> None:
    profile, _ = load_for_manager(db, user, talent_id)
    profile.deleted = True
    profile.updated_at = now_utc()
    db.flush()


def creator_contact(db: Session, profile: TalentProfile):
    """(email, name) del creador si es un gestor activo; al admin no se le avisa de su propia moderacion."""
    return db.execute(
        select(User.email, User.name).join(Role, Role.id == User.role_id)
        .where(User.id == profile.created_by, User.active.is_(True), Role.name == "GESTOR")
    ).first()


# ─────────────────────────── guardados (solo ciudadano) ───────────────────────────

def require_citizen(user: Optional[dict]) -> dict:
    if not user:
        raise AppError(401, "UNAUTHORIZED", "Inicia sesión para guardar")
    if user["role"] != "CIUDADANO":
        raise AppError(403, "FORBIDDEN", "Guardar es para las cuentas de ciudadano")
    return user


def require_verified_citizen(user: Optional[dict]) -> dict:
    """Guardar o quitar talento: ciudadano y con el correo verificado (GET /api/me/saved solo lee)."""
    return require_verified(require_citizen(user))


def add_favorite(db: Session, user: Optional[dict], talent_id: int) -> None:
    user = require_verified_citizen(user)
    visible = db.execute(select(TalentProfile.id).where(TalentProfile.id == talent_id, *_visible())).first()
    if not visible:
        raise AppError(404, "NOT_FOUND", "Este talento no está disponible")
    already = db.execute(
        select(TalentFavorite.talent_id).where(TalentFavorite.user_id == user["id"], TalentFavorite.talent_id == talent_id)
    ).first()
    if not already:
        db.add(TalentFavorite(user_id=user["id"], talent_id=talent_id, created_at=now_utc()))
        db.flush()


def remove_favorite(db: Session, user: Optional[dict], talent_id: int) -> None:
    """Idempotente, y tambien si el talento ya no esta publicado (no deja guardados huerfanos)."""
    user = require_verified_citizen(user)
    db.execute(delete(TalentFavorite).where(TalentFavorite.user_id == user["id"], TalentFavorite.talent_id == talent_id))


def saved_cards(db: Session, user: dict) -> list[dict]:
    """Tarjetas del talento guardado que sigue publicado, del guardado mas reciente al mas antiguo."""
    rows = db.execute(
        select(TalentProfile, TalentFavorite.created_at)
        .join(TalentFavorite, TalentFavorite.talent_id == TalentProfile.id)
        .where(TalentFavorite.user_id == user["id"], *_visible())
        .order_by(TalentFavorite.created_at.desc(), TalentProfile.id.desc())
    ).all()
    cards = _cards(db, [profile for profile, _ in rows], user)
    for card, (_, saved_at) in zip(cards, rows):
        card["saved_at"] = saved_at
    return cards
