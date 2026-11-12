"""Agenda publica (GET /api/agenda): solo EVENTOS publicados y sin borrar, en bloques.

- upcoming: con fecha de inicio y que no han terminado (incluye los "en curso"); por inicio ascendente.
- traditions: sin fecha de inicio, o con texto de tradicion y sin fecha por venir; por titulo.
- recent_past: terminaron en los ultimos RECENT_DAYS dias (sin texto de tradicion); del mas reciente
  al mas antiguo. Solo sin past.
- archive: con past=1, todos los que ya terminaron (sin texto de tradicion), del mas reciente al mas
  antiguo, de a ARCHIVE_PAGE ("Cargar mas" con offset).
Un evento termina en end_date o, si no hay, en start_date. "Hoy" es el dia de Bogota, el mismo del
carrusel (home_carousel.today_bogota): lo que termina hoy, a cualquier hora, sigue en proximos.
Cada evento lleva solo campos publicos (nada de autores, correos, ids de usuario ni moderacion).
"""
import re
from datetime import date, datetime, time, timedelta

from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.orm import Session

from backend.service.models.tables import Publication
from backend.service.schemas.cultural_categories import category_slug
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services.home_carousel import _cover_lookup as category_cover_lookup, today_bogota

RECENT_DAYS = 15
UPCOMING_LIMIT = 100
TRADITIONS_LIMIT = 60
RECENT_LIMIT = 60
ARCHIVE_PAGE = 24
# Las publicaciones viejas guardan un degradado CSS en image: solo vale un enlace.
_IMAGE_URL = re.compile(r"^(https?://|/)")

_COLUMNS = (Publication.id, Publication.title, Publication.summary, Publication.image, Publication.kind,
            Publication.municipality, Publication.cultural_category, Publication.location, Publication.start_date,
            Publication.end_date, Publication.tradition_text, Publication.tagline, Publication.tags)


def _event(row, cover) -> dict:
    category = row.cultural_category if cover.valid(row.cultural_category) else None
    image = row.image if row.image and _IMAGE_URL.match(row.image) else cover(category)
    event = {
        "id": row.id, "title": row.title, "summary": row.summary, "image": image, "kind": row.kind,
        "municipality": row.municipality if row.municipality in MUNICIPALITY_LABELS else None,
        "municipality_label": MUNICIPALITY_LABELS.get(row.municipality),
        "cultural_category": category_slug(category) if category else None,
        "category_label": cover.label(category),
        "location": (row.location or "").strip() or None,
        "start_date": row.start_date.isoformat() if row.start_date else None,
        "end_date": row.end_date.isoformat() if row.end_date else None,
        "tradition_text": row.tradition_text,
    }
    if row.tagline:
        event["tagline"] = row.tagline
    if row.tags:
        event["tags"] = list(row.tags)
    return event


def build_agenda(db: Session, municipality: str | None = None, category: str | None = None, past: bool = False,
                 offset: int = 0, today: date | None = None) -> dict:
    """municipality: slug de los 6; category: clave (MUSICA...). La ruta ya los valido."""
    today = today or today_bogota()
    start_of_today = datetime.combine(today, time.min)
    ends = func.coalesce(Publication.end_date, Publication.start_date)
    dated = Publication.start_date.is_not(None)
    has_tradition = Publication.tradition_text.is_not(None)
    ended = ends < start_of_today
    blocks = {
        "upcoming": and_(dated, not_(ended)),
        "traditions": or_(not_(dated), and_(has_tradition, ended)),
        "recent_past": and_(dated, not_(has_tradition), ended, ends >= start_of_today - timedelta(days=RECENT_DAYS)),
        "archive": and_(dated, not_(has_tradition), ended),
    }
    shown = ["upcoming", "traditions", "archive" if past else "recent_past"]

    conditions = [Publication.status == "PUBLISHED", Publication.deleted.is_(False), Publication.kind == "EVENTO"]
    if municipality:
        conditions.append(Publication.municipality == municipality)
    if category:
        conditions.append(Publication.cultural_category == category)

    counts = dict(zip(shown, db.execute(
        select(*(func.count().filter(blocks[name]) for name in shown)).where(*conditions)
    ).one()))

    orders = {
        "upcoming": (Publication.start_date.asc(), Publication.id.asc()),
        "traditions": (func.lower(Publication.title).asc(), Publication.id.asc()),
        "recent_past": (ends.desc(), Publication.id.desc()),
        "archive": (ends.desc(), Publication.id.desc()),
    }
    limits = {"upcoming": UPCOMING_LIMIT, "traditions": TRADITIONS_LIMIT, "recent_past": RECENT_LIMIT,
              "archive": ARCHIVE_PAGE}
    cover = category_cover_lookup(db)
    result = {"today": today.isoformat()}
    for name in shown:
        stmt = (select(*_COLUMNS).where(*conditions, blocks[name]).order_by(*orders[name]).limit(limits[name]))
        if name == "archive":
            stmt = stmt.offset(offset)
        result[name] = [_event(row, cover) for row in db.execute(stmt).all()]
    result["counts"] = counts
    if past:
        next_offset = offset + len(result["archive"])
        result["archive_next_offset"] = next_offset if next_offset < counts["archive"] else None
    return result
