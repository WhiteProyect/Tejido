import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy import DateTime, and_, cast, exists, func, literal, or_, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import (Category, Event, Favorite, Opportunity, OpportunityType, Organization, Place,
                                           PlaceCategory, Publication, Role, User)
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS
from backend.service.schemas.publications import PublicationInput
from backend.service.services.branches import leader_of
from backend.service.services.municipalities import PUBLICATION_MESSAGE, require_municipality
from backend.service.services.org_profiles import visible_slug
from backend.service.services.serialization import row_to_dict, rows_to_dicts


TAGLINE_MAX = 100
TAGS_MAX = 3
TAG_MAX = 24
TRADITION_MAX = 80
ORGANIZER_MAX = 120
REQUIREMENTS_MAX = 8
REQUIREMENT_MAX = 160
PRIZE_MAX = 120
AUDIENCE_MAX = 160
LINK_MAX = 500
# Caja del Bajo Cauca con margen (lat 6.8 a 8.8, lng -76.0 a -74.0): los seis municipios caben con
# 0,2 a 0,5 grados de holgura. Fuera de ella el punto se rechaza (422).
BAJO_CAUCA_BOX = {"lat": (Decimal("6.8"), Decimal("8.8")), "lng": (Decimal("-76.0"), Decimal("-74.0"))}
POINT_MISSING = {"EVENTO": "Marca el punto exacto del evento en el mapa", "LUGAR": "Marca el punto exacto del lugar en el mapa"}
ADDRESS_MAX = 160
PHONE_MAX = 30
OPENING_HOURS_MAX = 200
WEBSITE_MAX = 200
PLACE_FORBIDDEN = "Solo el equipo de TEJIDO y los líderes pueden agregar lugares"
_PHONE = re.compile(r"^[0-9+\-() ]+$")
_HTML = re.compile(r"<[^>]*>")


def now_utc():
    return datetime.now(timezone.utc)


def _plain(value) -> str:
    """Texto de una linea, sin HTML y sin espacios de sobra."""
    return " ".join(_HTML.sub(" ", str(value)).split())


def clean_tagline(value) -> str | None:
    """Eslogan opcional: sin HTML, recortado; vacio = None; hasta TAGLINE_MAX caracteres (422)."""
    if value is None:
        return None
    text = _plain(value)
    if len(text) > TAGLINE_MAX:
        raise AppError(422, "INVALID_TAGLINE", f"El eslogan no puede pasar de {TAGLINE_MAX} caracteres")
    return text or None


def clean_tags(values) -> list[str]:
    """Etiquetas opcionales: sin HTML, recortadas, sin vacias ni repetidas (sin distinguir mayusculas);
    hasta TAGS_MAX de TAG_MAX caracteres cada una (422)."""
    if values is None:
        return []
    if isinstance(values, str) or not isinstance(values, (list, tuple)):
        raise AppError(422, "INVALID_TAGS", "Las etiquetas deben ser una lista")
    tags, seen = [], set()
    for value in values:
        if value is None:
            continue
        tag = _plain(value)
        if not tag or tag.casefold() in seen:
            continue
        if len(tag) > TAG_MAX:
            raise AppError(422, "INVALID_TAGS", f"Cada etiqueta puede tener hasta {TAG_MAX} caracteres")
        seen.add(tag.casefold())
        tags.append(tag)
    if len(tags) > TAGS_MAX:
        raise AppError(422, "INVALID_TAGS", f"Máximo {TAGS_MAX} etiquetas")
    return tags


def clean_tradition_text(value, kind: str) -> str | None:
    """Fecha habitual de un EVENTO ("Cada 20 de julio"): sin HTML, recortada; vacia = None; hasta
    TRADITION_MAX caracteres (422). En los demas tipos se ignora (queda None): el formulario solo la
    pide en EVENTO y cambiar el tipo de una publicacion no debe fallar por un campo que ya no ve."""
    if value is None or kind != "EVENTO":
        return None
    text = _plain(value)
    if len(text) > TRADITION_MAX:
        raise AppError(422, "INVALID_TRADITION_TEXT", f"El texto de tradición no puede pasar de {TRADITION_MAX} caracteres")
    return text or None


def _optional_text(value, limit: int, code: str, message: str) -> str | None:
    if value is None:
        return None
    if isinstance(value, (list, dict, tuple)):
        raise AppError(422, code, message)
    text = _plain(value)
    if len(text) > limit:
        raise AppError(422, code, message)
    return text or None


def _coordinate(value) -> Decimal:
    if isinstance(value, bool) or value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError
    number = Decimal(str(value).strip())
    if not number.is_finite():
        raise ValueError
    return number.quantize(Decimal("0.000001"))


def clean_point(latitude, longitude, kind: str) -> tuple[Decimal | None, Decimal | None]:
    """Punto exacto (latitud, longitud). EVENTO y LUGAR: obligatorio, las dos juntas, numericas y dentro
    del Bajo Cauca (422). Otros tipos: se descartan (None, None); no llevan punto ni van al mapa."""
    if kind not in POINT_MISSING:
        return None, None
    missing = [value in (None, "") for value in (latitude, longitude)]
    if any(missing):
        raise AppError(422, "POINT_REQUIRED", POINT_MISSING[kind])
    try:
        lat, lng = _coordinate(latitude), _coordinate(longitude)
    except (ValueError, InvalidOperation, TypeError):
        raise AppError(422, "INVALID_POINT", "Las coordenadas del punto deben ser números")
    (lat_min, lat_max), (lng_min, lng_max) = BAJO_CAUCA_BOX["lat"], BAJO_CAUCA_BOX["lng"]
    if not (lat_min <= lat <= lat_max and lng_min <= lng <= lng_max):
        raise AppError(422, "POINT_OUT_OF_AREA", "El punto debe estar dentro del Bajo Cauca")
    return lat, lng


def clean_requirements(values) -> list[str]:
    """Requisitos: sin HTML, recortados, sin vacios ni repetidos (sin distinguir mayusculas); hasta
    REQUIREMENTS_MAX de REQUIREMENT_MAX caracteres (422)."""
    if values is None:
        return []
    if isinstance(values, str) or not isinstance(values, (list, tuple)):
        raise AppError(422, "INVALID_REQUIREMENTS", "Los requisitos deben ser una lista")
    items, seen = [], set()
    for value in values:
        if value is None:
            continue
        text = _plain(value)
        if not text or text.casefold() in seen:
            continue
        if len(text) > REQUIREMENT_MAX:
            raise AppError(422, "INVALID_REQUIREMENTS", f"Cada requisito puede tener hasta {REQUIREMENT_MAX} caracteres")
        seen.add(text.casefold())
        items.append(text)
    if len(items) > REQUIREMENTS_MAX:
        raise AppError(422, "INVALID_REQUIREMENTS", f"Máximo {REQUIREMENTS_MAX} requisitos")
    return items


def clean_application_link(value) -> str:
    """Enlace de postulacion de una OPORTUNIDAD: obligatorio, http(s) con dominio, sin espacios."""
    text = str(value or "").strip()
    if not text:
        raise AppError(422, "LINK_REQUIRED", "Agrega el enlace de postulación")
    parsed = urlparse(text)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or any(char.isspace() for char in text):
        raise AppError(422, "INVALID_LINK", "El enlace de postulación debe ser una dirección web que empiece por http:// o https://")
    if len(text) > LINK_MAX:
        raise AppError(422, "INVALID_LINK", f"El enlace de postulación puede tener hasta {LINK_MAX} caracteres")
    return text


def clean_opportunity(db: Session, item: PublicationInput, current_type_id: int | None = None) -> dict | None:
    """Campos de una OPORTUNIDAD (None en otros tipos: ahi se ignoran). Tipo obligatorio y activo (al
    editar se puede conservar el que ya tenia aunque luego se haya desactivado); quien convoca
    obligatorio; requisitos, premio y dirigida a opcionales; enlace de postulacion obligatorio."""
    if item.kind != "OPORTUNIDAD":
        return None
    raw_type = item.opportunity_type_id
    if raw_type in (None, ""):
        raise AppError(422, "OPPORTUNITY_TYPE_REQUIRED", "Elige el tipo de oportunidad")
    try:
        type_id = int(raw_type)
    except (TypeError, ValueError):
        raise AppError(422, "INVALID_OPPORTUNITY_TYPE", "Ese tipo de oportunidad no existe o está desactivado")
    active = db.execute(select(OpportunityType.active).where(OpportunityType.id == type_id)).scalar_one_or_none()
    if active is None or (not active and type_id != current_type_id):
        raise AppError(422, "INVALID_OPPORTUNITY_TYPE", "Ese tipo de oportunidad no existe o está desactivado")
    organizer = _optional_text(item.organizer, ORGANIZER_MAX, "INVALID_ORGANIZER",
                               f"Quién convoca puede tener hasta {ORGANIZER_MAX} caracteres")
    if not organizer:
        raise AppError(422, "ORGANIZER_REQUIRED", "Escribe quién convoca")
    return {
        "type_id": type_id,
        "organizer": organizer,
        "requirements": clean_requirements(item.requirements),
        "prize": _optional_text(item.prize, PRIZE_MAX, "INVALID_PRIZE", f"El premio o monto puede tener hasta {PRIZE_MAX} caracteres"),
        "audience": _optional_text(item.audience, AUDIENCE_MAX, "INVALID_AUDIENCE", f"«Dirigida a» puede tener hasta {AUDIENCE_MAX} caracteres"),
        "link": clean_application_link(item.link),
    }


def _single_value(value, code: str, message: str) -> str | None:
    """Texto de una linea (espacios colapsados) de un valor suelto; None si no llega."""
    if value is None:
        return None
    if isinstance(value, (list, dict, tuple, bool)):
        raise AppError(422, code, message)
    return " ".join(str(value).split())


def clean_phone(value) -> str | None:
    """Telefono opcional: recortado, hasta PHONE_MAX, solo digitos y + - ( ) y espacios, con 7 digitos o mas."""
    message = "Escribe el teléfono solo con números y los signos + - ( )"
    text = _single_value(value, "INVALID_PHONE", message)
    if not text:
        return None
    if len(text) > PHONE_MAX:
        raise AppError(422, "INVALID_PHONE", f"El teléfono puede tener hasta {PHONE_MAX} caracteres")
    if not _PHONE.match(text) or sum(char.isdigit() for char in text) < 7:
        raise AppError(422, "INVALID_PHONE", message)
    return text


def clean_whatsapp(value) -> str | None:
    """WhatsApp opcional, guardado como digitos con indicativo (lo que pide https://wa.me/<numero>).
    Acepta los mismos signos que el telefono. Con "+" o "00" delante se toma tal cual; 10 digitos sin
    indicativo = numero de Colombia (se antepone 57); 12 digitos que empiezan por 57 ya lo traen. El
    resultado debe tener entre 8 y 15 digitos (E.164)."""
    text = _single_value(value, "INVALID_WHATSAPP", "Escribe el WhatsApp solo con números y los signos + - ( )")
    if not text:
        return None
    if len(text) > PHONE_MAX:
        raise AppError(422, "INVALID_WHATSAPP", f"El WhatsApp puede tener hasta {PHONE_MAX} caracteres")
    if not _PHONE.match(text):
        raise AppError(422, "INVALID_WHATSAPP", "Escribe el WhatsApp solo con números y los signos + - ( )")
    digits = "".join(char for char in text if char.isdigit())
    if text.startswith("+"):
        number = digits
    elif digits.startswith("00"):
        number = digits[2:]
    elif len(digits) == 12 and digits.startswith("57"):
        number = digits
    elif len(digits) == 10:
        number = "57" + digits
    else:
        number = ""
    if not 8 <= len(number) <= 15:
        raise AppError(422, "INVALID_WHATSAPP",
                       "Escribe el WhatsApp con 10 dígitos (celular de Colombia) o con su indicativo, p. ej. +57 300 123 4567")
    return number


def clean_website(value) -> str | None:
    """Sitio web opcional: http(s) con dominio, sin espacios, hasta WEBSITE_MAX."""
    message = "El sitio web debe ser una dirección que empiece por http:// o https://"
    if value is None:
        return None
    if isinstance(value, (list, dict, tuple, bool)):
        raise AppError(422, "INVALID_WEBSITE", message)
    text = str(value).strip()
    if not text:
        return None
    parsed = urlparse(text)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or any(char.isspace() for char in text):
        raise AppError(422, "INVALID_WEBSITE", message)
    if len(text) > WEBSITE_MAX:
        raise AppError(422, "INVALID_WEBSITE", f"El sitio web puede tener hasta {WEBSITE_MAX} caracteres")
    return text


def clean_place(db: Session, item: PublicationInput, current_category_id: int | None = None) -> dict | None:
    """Campos de un LUGAR (None en otros tipos: ahi se ignoran). Categoria de lugar obligatoria y activa
    (al editar se puede conservar la que ya tenia aunque luego se haya desactivado); direccion o referencia
    obligatoria (publications.location, hasta ADDRESS_MAX); telefono, WhatsApp, horario y sitio web
    opcionales. Devuelve solo los opcionales que llegaron en la peticion (y siempre la categoria y la
    direccion): lo que no se manda se conserva al editar (UPSERT en _sync_publication_detail)."""
    if item.kind != "LUGAR":
        return None
    raw = item.place_category_id
    if raw in (None, ""):
        raise AppError(422, "PLACE_CATEGORY_REQUIRED", "Elige la categoría del lugar")
    try:
        if isinstance(raw, bool):
            raise ValueError
        category_id = int(raw)
    except (TypeError, ValueError):
        raise AppError(422, "INVALID_PLACE_CATEGORY", "Esa categoría de lugar no existe o está desactivada")
    active = db.execute(select(PlaceCategory.active).where(PlaceCategory.id == category_id)).scalar_one_or_none()
    if active is None or (not active and category_id != current_category_id):
        raise AppError(422, "INVALID_PLACE_CATEGORY", "Esa categoría de lugar no existe o está desactivada")
    address = _plain(item.location)
    if not address:
        raise AppError(422, "ADDRESS_REQUIRED", "Escribe la dirección o una referencia para llegar")
    if len(address) > ADDRESS_MAX:
        raise AppError(422, "INVALID_ADDRESS", f"La dirección o referencia puede tener hasta {ADDRESS_MAX} caracteres")
    sent = item.model_fields_set
    values = {"place_category_id": category_id, "address": address}
    if "phone" in sent:
        values["phone"] = clean_phone(item.phone)
    if "whatsapp" in sent:
        values["whatsapp"] = clean_whatsapp(item.whatsapp)
    if "opening_hours" in sent:
        values["opening_hours"] = _optional_text(item.opening_hours, OPENING_HOURS_MAX, "INVALID_OPENING_HOURS",
                                                 f"El horario puede tener hasta {OPENING_HOURS_MAX} caracteres")
    if "website" in sent:
        values["website"] = clean_website(item.website)
    return values


def can_author_places(db: Session, user: Optional[dict]) -> bool:
    """Crean y editan lugares solo el ADMIN y el GESTOR lider de su rama (organizations.is_leader)."""
    if not user:
        return False
    if user["role"] == "ADMIN":
        return True
    return user["role"] == "GESTOR" and leader_of(db, user["id"]) is not None


def require_place_author(db: Session, user: Optional[dict]) -> None:
    if not can_author_places(db, user):
        raise AppError(403, "FORBIDDEN", PLACE_FORBIDDEN)


# Columnas del detalle de oportunidad que viajan con cada publicacion (listados, guardadas y
# detalle). En las que no son OPORTUNIDAD se quitan (with_opportunity_fields).
_OPPORTUNITY_KEYS = ("opportunity_type_id", "opportunity_type_slug", "opportunity_type_label", "opportunity_type_color", "organizer",
                     "requirements", "prize", "audience")


def _opportunity_columns():
    return (Opportunity.type_id.label("opportunity_type_id"), OpportunityType.slug.label("opportunity_type_slug"),
            OpportunityType.label.label("opportunity_type_label"), OpportunityType.color.label("opportunity_type_color"),
            Opportunity.organizer, Opportunity.requirements,
            Opportunity.prize, Opportunity.audience)


def _join_opportunity(stmt):
    """Detalle de oportunidad y de lugar (outer joins: una fila por publicacion)."""
    return (stmt.join(Opportunity, Opportunity.publication_id == Publication.id, isouter=True)
                .join(OpportunityType, OpportunityType.id == Opportunity.type_id, isouter=True)
                .join(Place, Place.publication_id == Publication.id, isouter=True)
                .join(PlaceCategory, PlaceCategory.id == Place.place_category_id, isouter=True))


# Lo mismo para el detalle de un LUGAR (with_place_fields). La direccion es location.
_PLACE_KEYS = ("place_category_id", "place_category_slug", "place_category_label", "place_category_icon",
               "place_category_color", "place_category_active", "phone", "whatsapp", "opening_hours", "website")


def _place_columns():
    return (Place.place_category_id, PlaceCategory.slug.label("place_category_slug"),
            PlaceCategory.label.label("place_category_label"), PlaceCategory.icon.label("place_category_icon"),
            PlaceCategory.color.label("place_category_color"), PlaceCategory.active.label("place_category_active"),
            Place.phone, Place.whatsapp, Place.opening_hours, Place.website)


def with_place_fields(row: dict | None) -> dict | None:
    """LUGAR: place_category ({id, slug, label, icon, color, active} o None si es un lugar antiguo sin
    completar), address (= location), phone, whatsapp, opening_hours y website. Las demas, sin estas claves."""
    if row is None:
        return None
    values = {key: row.pop(key, None) for key in _PLACE_KEYS}
    if row.get("kind") != "LUGAR":
        return row
    category_id = values["place_category_id"]
    row["place_category"] = ({"id": category_id, "slug": values["place_category_slug"], "label": values["place_category_label"],
                              "icon": values["place_category_icon"], "color": values["place_category_color"],
                              "active": values["place_category_active"]}
                             if category_id is not None else None)
    row.update(address=row.get("location"), phone=values["phone"], whatsapp=values["whatsapp"],
               opening_hours=values["opening_hours"], website=values["website"])
    return row


def with_opportunity_fields(row: dict | None) -> dict | None:
    """OPORTUNIDAD: opportunity_type ({id, slug, label} o None), organizer, requirements (lista),
    prize y audience. Las demas publicaciones quedan como siempre (sin estas claves)."""
    if row is None:
        return None
    with_place_fields(row)
    values = {key: row.pop(key, None) for key in _OPPORTUNITY_KEYS}
    if row.get("kind") != "OPORTUNIDAD":
        return row
    type_id = values["opportunity_type_id"]
    row["opportunity_type"] = ({"id": type_id, "slug": values["opportunity_type_slug"], "label": values["opportunity_type_label"],
                                "color": values["opportunity_type_color"]}
                               if type_id is not None else None)
    row.update(organizer=values["organizer"], requirements=values["requirements"] or [], prize=values["prize"],
               audience=values["audience"])
    return row


def list_publications(
    db: Session,
    user: Optional[dict],
    mine: Optional[str] = None,
    status: Optional[str] = None,
    kind: Optional[str] = None,
    search: Optional[str] = None,
    cultural_category: Optional[str] = None,
    municipality: Optional[str] = None,
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

    if municipality:
        conditions.append(Publication.municipality == municipality)

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

    stmt = _join_opportunity(
        select(Publication.__table__, Category.name.label("category"), Category.color.label("color"),
               User.name.label("author"), favorite_expr, *_opportunity_columns(), *_place_columns())
        .join(Category, Category.id == Publication.category_id)
        .join(User, User.id == Publication.author_id)
    ).where(*conditions).order_by(
            Publication.featured.desc(),
            # start_date es DateTime sin tz; created_at es TIMESTAMPTZ -- se
            # castea a DateTime (sin tz) para que COALESCE compare tipos
            # compatibles (Postgres no mezcla timestamp con/sin tz directo).
            func.coalesce(Publication.start_date, cast(Publication.created_at, DateTime)).desc(),
        )
    return [with_opportunity_fields(row) for row in rows_to_dicts(db.execute(stmt).all())]


def saved_publications(db: Session, user_id: int) -> list[dict]:
    """Lo que guardo ese usuario y sigue publicado: el mismo shape que list_publications (favorite
    siempre true) mas saved_at, del guardado mas reciente al mas antiguo."""
    stmt = _join_opportunity(
        select(Publication.__table__, Category.name.label("category"), Category.color.label("color"),
               User.name.label("author"), literal(True).label("favorite"), Favorite.created_at.label("saved_at"),
               *_opportunity_columns(), *_place_columns())
        .join(Favorite, and_(Favorite.publication_id == Publication.id, Favorite.user_id == user_id))
        .join(Category, Category.id == Publication.category_id)
        .join(User, User.id == Publication.author_id)
    ).where(Publication.status == "PUBLISHED", Publication.deleted.is_(False)).order_by(
        Favorite.created_at.desc(), Publication.id.desc())
    return [with_opportunity_fields(row) for row in rows_to_dicts(db.execute(stmt).all())]


def get_publication(db: Session, user: Optional[dict], publication_id: int):
    favorite_uid = user["id"] if user else -1
    favorite_expr = (
        exists(select(1).where(Favorite.publication_id == Publication.id, Favorite.user_id == favorite_uid))
        .label("favorite")
    )
    stmt = _join_opportunity(
        select(Publication.__table__, Category.name.label("category"), Category.color.label("color"),
               User.name.label("author"), favorite_expr, *_opportunity_columns(), *_place_columns())
        .join(Category, Category.id == Publication.category_id)
        .join(User, User.id == Publication.author_id)
    ).where(Publication.id == publication_id, Publication.deleted.is_(False))
    return with_opportunity_fields(row_to_dict(db.execute(stmt).first()))


def get_publication_detail(db: Session, user: Optional[dict], publication_id: int):
    """get_publication + lo que necesita la pagina de la publicacion (#publicacion/<id>): datos de
    su evento u oportunidad, la organizacion publica del autor (solo nombre, rama y foto, lo mismo
    que GET /api/gestores) y la galeria. Los permisos los resuelve la ruta."""
    row = get_publication(db, user, publication_id)
    if not row:
        return None
    extra = db.execute(
        select(Event.venue, Event.capacity, Opportunity.deadline)
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
        select(Publication.id, Publication.status, Publication.author_id, Publication.kind)
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


def resolve_cultural_category(db: Session, user: dict, requested: str | None, kind: str | None = None) -> str | None:
    """Un GESTOR solo publica en su rama: vacia se le asigna, otra es 403, sin rama 409.
    El ADMIN elige cualquiera (o ninguna). Excepcion de LUGAR (solo lo crea el lider; la ruta ya lo
    comprobo): la categoria es opcional, ninguna o la de su rama (otra, 403)."""
    if user["role"] != "GESTOR":
        return requested
    if kind == "LUGAR":
        branch = leader_of(db, user["id"])
        if requested and requested != branch:
            label = CULTURAL_CATEGORY_LABELS.get(branch, "tu rama")
            raise AppError(403, "FORBIDDEN", f"En un lugar solo puedes elegir tu rama ({label}) o dejarlo sin categoría cultural")
        return requested or None
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


def _sync_publication_detail(db: Session, publication_id: int, item: PublicationInput, opportunity: dict | None,
                             place: dict | None = None):
    """Fila de detalle segun el tipo: se actualiza si ya existe (UPSERT: lo que la API no manda, como el
    cupo de un evento o un dato opcional de un lugar que no viene en la peticion, sobrevive a las
    ediciones) y se borra si la publicacion cambio de tipo."""
    event = db.execute(select(Event).where(Event.publication_id == publication_id)).scalar_one_or_none()
    if item.kind == "EVENTO":
        if event:
            event.venue = item.location
        else:
            db.add(Event(publication_id=publication_id, venue=item.location, capacity=None))
    elif event:
        db.delete(event)

    detail = db.execute(select(Opportunity).where(Opportunity.publication_id == publication_id)).scalar_one_or_none()
    if item.kind == "OPORTUNIDAD":
        values = {key: value for key, value in opportunity.items() if key != "link"}
        values["deadline"] = item.end_date
        if detail:
            for key, value in values.items():
                setattr(detail, key, value)
        else:
            db.add(Opportunity(publication_id=publication_id, **values))
    elif detail:
        db.delete(detail)

    place_row = db.execute(select(Place).where(Place.publication_id == publication_id)).scalar_one_or_none()
    if item.kind == "LUGAR":
        values = {key: value for key, value in place.items() if key != "address"}
        if place_row:
            for key, value in values.items():
                setattr(place_row, key, value)
        else:
            db.add(Place(publication_id=publication_id, **values))
    elif place_row:
        db.delete(place_row)


def create_publication(db: Session, user: dict, item: PublicationInput) -> int:
    municipality = require_municipality(item.municipality, PUBLICATION_MESSAGE)
    tagline, tags = clean_tagline(item.tagline), clean_tags(item.tags)
    tradition_text = clean_tradition_text(item.tradition_text, item.kind)
    opportunity = clean_opportunity(db, item)
    place = clean_place(db, item)
    validate_category(db, item.category_id, item.kind)
    latitude, longitude = clean_point(item.latitude, item.longitude, item.kind)
    cultural_category = resolve_cultural_category(db, user, item.cultural_category, item.kind)
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
        location=place["address"] if place else item.location,
        start_date=item.start_date,
        end_date=item.end_date,
        link=opportunity["link"] if opportunity else item.link,
        cultural_category=cultural_category,
        municipality=municipality,
        tagline=tagline,
        tags=tags,
        tradition_text=tradition_text,
        latitude=latitude,
        longitude=longitude,
        featured=bool(item.featured) if user["role"] == "ADMIN" else False,
        status=status,
        created_at=ts,
        updated_at=ts,
    )
    db.add(publication)
    db.flush()
    _sync_publication_detail(db, publication.id, item, opportunity, place)
    return publication.id


def update_publication(db: Session, user: dict, publication_id: int, current_status: str, item: PublicationInput):
    # Editar una publicacion antigua sin municipio obliga a elegirlo.
    municipality = require_municipality(item.municipality, PUBLICATION_MESSAGE)
    tagline, tags = clean_tagline(item.tagline), clean_tags(item.tags)
    tradition_text = clean_tradition_text(item.tradition_text, item.kind)
    current_type = db.execute(select(Opportunity.type_id).where(Opportunity.publication_id == publication_id)).scalar_one_or_none()
    opportunity = clean_opportunity(db, item, current_type_id=current_type)
    current_place = db.execute(select(Place.place_category_id).where(Place.publication_id == publication_id)).scalar_one_or_none()
    place = clean_place(db, item, current_category_id=current_place)
    latitude, longitude = clean_point(item.latitude, item.longitude, item.kind)
    cultural_category = resolve_cultural_category(db, user, item.cultural_category, item.kind)
    status, clear_note = status_after_edit(user, current_status, item.publish)
    changes = {
        "category_id": item.category_id,
        "kind": item.kind,
        "title": item.title,
        "summary": item.summary,
        "content": item.content,
        "image": item.image,
        "location": place["address"] if place else item.location,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "link": opportunity["link"] if opportunity else item.link,
        "cultural_category": cultural_category,
        "municipality": municipality,
        "tagline": tagline,
        "tags": tags,
        "tradition_text": tradition_text,
        "latitude": latitude,
        "longitude": longitude,
        "status": status,
        "updated_at": now_utc(),
    }
    if clear_note:
        changes["moderation_note"] = None
    db.query(Publication).filter(Publication.id == publication_id).update(changes)
    _sync_publication_detail(db, publication_id, item, opportunity, place)
    return status
