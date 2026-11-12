"""Pulso del dashboard del admin: catalogo de tarjetas, estadisticas y preferencias por admin.

El catalogo (ids fijos y estables) vive SOLO aqui; el frontend pone etiqueta, icono y enlace a cada id
(frontend/src/utils/pulsoCatalog.js). Cada tarjeta lee una clave de GET /api/admin/stats; las que ya
existian conservan su nombre (published, pending, users...). La unida "revision_talento_artistas" suma
talent_review y artists_review.

Preferencias: admin_preferences.pulso = lista ORDENADA de ids visibles (visible = esta en la lista).
Sin fila (o con una lista que tras descartar ids retirados queda vacia), el default.
"""
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import and_, delete, func, not_, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import AdminPreference, Artist, BranchJoinRequest, Publication, Report, Role, Suggestion, TalentProfile, User
from backend.service.services.home_carousel import today_bogota

# id de tarjeta -> clave de /api/admin/stats (None: compuesta en el frontend).
CATALOG = {
    "publicadas": "published",
    "en_revision": "pending",
    "gestores_activos": "gestores_activos",
    "usuarios_activos": "users",
    "reportes": "reports",
    "mensajes": "suggestions",
    "solicitudes_ingreso": "join_requests",
    "revision_talento_artistas": None,
    "borradores": "borradores",
    "eventos_proximos": "eventos_proximos",
    "oportunidades_abiertas": "oportunidades_abiertas",
    "lugares_publicados": "lugares_publicados",
    "talento_publicado": "talento_publicado",
    "artistas_tejido": "artistas_tejido",
    "artistas_moneystack": "artistas_moneystack",
    "ciudadanos_nuevos_7d": "ciudadanos_nuevos_7d",
    "usuarios_inactivos_o_invitados": "usuarios_inactivos_o_invitados",
    "talento_por_revisar": "talent_review",
    "artistas_por_revisar": "artists_review",
}
DEFAULT = ["publicadas", "en_revision", "gestores_activos", "usuarios_activos", "reportes", "mensajes", "solicitudes_ingreso",
           "revision_talento_artistas"]
MIN_CARDS = 1
MAX_CARDS = 12
NEW_CITIZEN_DAYS = 7


def compute_stats(db: Session) -> dict:
    """Todas las claves del catalogo en 7 consultas agregadas (sin N+1): publicaciones, usuarios, artistas,
    talento, reportes, mensajes y solicitudes. Ninguna es pesada: cuentan con FILTER sobre tablas chicas."""
    start_of_today = datetime.combine(today_bogota(), time.min)
    live = Publication.deleted.is_(False)
    published = and_(live, Publication.status == "PUBLISHED")
    ends = func.coalesce(Publication.end_date, Publication.start_date)
    pubs = db.execute(select(
        func.count().filter(published).label("published"),
        func.count().filter(live, Publication.status == "REVIEW").label("pending"),
        func.count().filter(live, Publication.status == "DRAFT").label("borradores"),
        # Como la Agenda: con fecha de inicio y sin terminar (incluye los en curso).
        func.count().filter(published, Publication.kind == "EVENTO", Publication.start_date.is_not(None), not_(ends < start_of_today)).label("eventos_proximos"),
        # Como Oportunidades: cierre hoy o despues, o sin cierre (convocatoria abierta).
        func.count().filter(published, Publication.kind == "OPORTUNIDAD", or_(Publication.end_date.is_(None), Publication.end_date >= start_of_today)).label("oportunidades_abiertas"),
        func.count().filter(published, Publication.kind == "LUGAR").label("lugares_publicados"),
    ).select_from(Publication)).one()
    since = datetime.now(timezone.utc) - timedelta(days=NEW_CITIZEN_DAYS)
    users = db.execute(select(
        func.count().filter(User.active.is_(True)).label("users"),
        func.count().filter(Role.name == "GESTOR", User.active.is_(True)).label("gestores_activos"),
        func.count().filter(User.active.is_(False)).label("usuarios_inactivos_o_invitados"),
        func.count().filter(Role.name == "CIUDADANO", User.created_at >= since).label("ciudadanos_nuevos_7d"),
    ).select_from(User).join(Role, Role.id == User.role_id)).one()
    artists = db.execute(select(
        func.count().filter(Artist.status == "REVIEW").label("artists_review"),
        func.count().filter(Artist.status == "PUBLISHED", Artist.moneystack.is_(False)).label("artistas_tejido"),
        func.count().filter(Artist.status == "PUBLISHED", Artist.moneystack.is_(True)).label("artistas_moneystack"),
    ).select_from(Artist).where(Artist.active.is_(True))).one()
    talent = db.execute(select(
        func.count().filter(TalentProfile.status == "REVIEW").label("talent_review"),
        func.count().filter(TalentProfile.status == "PUBLISHED").label("talento_publicado"),
    ).select_from(TalentProfile).where(TalentProfile.deleted.is_(False))).one()
    reports = db.execute(select(func.count()).select_from(Report).where(Report.status == "OPEN")).scalar_one()
    suggestions = db.execute(select(func.count()).select_from(Suggestion).where(Suggestion.status == "NEW")).scalar_one()
    join_requests = db.execute(select(func.count()).select_from(BranchJoinRequest).where(BranchJoinRequest.status == "PENDING")).scalar_one()
    return {**pubs._asdict(), **users._asdict(), **artists._asdict(), **talent._asdict(),
            "reports": reports, "suggestions": suggestions, "join_requests": join_requests}


def _clean(ids) -> list:
    """Descarta en silencio los ids que ya no estan en el catalogo y los repetidos."""
    seen = []
    for item in ids if isinstance(ids, list) else []:
        if item in CATALOG and item not in seen:
            seen.append(item)
    return seen[:MAX_CARDS]


def get_pulso(db: Session, user_id: int) -> dict:
    row = db.get(AdminPreference, user_id)
    cards = _clean(row.pulso) if row else []
    if not cards:
        return {"pulso": list(DEFAULT), "is_default": True, "catalog": list(CATALOG), "max": MAX_CARDS}
    return {"pulso": cards, "is_default": False, "catalog": list(CATALOG), "max": MAX_CARDS}


def validate_pulso(ids) -> list:
    if not isinstance(ids, list) or not all(isinstance(item, str) for item in ids):
        raise AppError(422, "INVALID_PULSO", "El Pulso debe ser una lista de tarjetas")
    if len(ids) < MIN_CARDS:
        raise AppError(422, "INVALID_PULSO", "Deja al menos una tarjeta visible en el Pulso")
    if len(ids) > MAX_CARDS:
        raise AppError(422, "INVALID_PULSO", f"El Pulso admite como máximo {MAX_CARDS} tarjetas")
    if len(set(ids)) != len(ids):
        raise AppError(422, "INVALID_PULSO", "Hay tarjetas repetidas en el Pulso")
    unknown = [item for item in ids if item not in CATALOG]
    if unknown:
        raise AppError(422, "INVALID_PULSO", f"Tarjeta desconocida: {unknown[0]}")
    return ids


def save_pulso(db: Session, user_id: int, ids) -> dict:
    """UPSERT de la lista del admin. No hace commit."""
    cards = validate_pulso(ids)
    statement = insert(AdminPreference).values(user_id=user_id, pulso=cards, updated_at=datetime.now(timezone.utc))
    db.execute(statement.on_conflict_do_update(index_elements=[AdminPreference.user_id],
                                               set_={"pulso": statement.excluded.pulso, "updated_at": statement.excluded.updated_at}))
    db.flush()
    return {"pulso": cards, "is_default": False, "catalog": list(CATALOG), "max": MAX_CARDS}


def reset_pulso(db: Session, user_id: int) -> dict:
    db.execute(delete(AdminPreference).where(AdminPreference.user_id == user_id))
    db.flush()
    return {"pulso": list(DEFAULT), "is_default": True, "catalog": list(CATALOG), "max": MAX_CARDS}
