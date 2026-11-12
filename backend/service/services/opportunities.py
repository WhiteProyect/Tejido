"""Oportunidades publicas (GET /api/opportunities): solo OPORTUNIDAD publicadas y sin borrar, en bloques.

- open: con fecha de cierre hoy o despues (las que cierran hoy siguen abiertas, hasta el final del dia
  de Bogota); de la que cierra antes a la que cierra despues.
- open_ended: sin fecha de cierre ("convocatoria abierta"); de la mas reciente a la mas antigua.
- closed: el cierre ya paso; de la mas reciente a la mas antigua, de a CLOSED_PAGE ("Cargar mas").
Con soon=1 solo quedan las abiertas que cierran en SOON_DAYS dias o menos (open_ended y closed vacios).
El cierre es publications.end_date (el mismo que usa el carrusel). "Hoy" es el dia de Bogota
(home_carousel.today_bogota). Cada oportunidad lleva solo campos publicos.
"""
import re
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.models.tables import Opportunity, OpportunityType, Publication
from backend.service.schemas.cultural_categories import category_slug
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services.home_carousel import _cover_lookup as category_cover_lookup, today_bogota

SOON_DAYS = 7
OPEN_LIMIT = 100
OPEN_ENDED_LIMIT = 60
CLOSED_PAGE = 12
_IMAGE_URL = re.compile(r"^(https?://|/)")

_COLUMNS = (Publication.id, Publication.title, Publication.summary, Publication.image, Publication.municipality,
            Publication.cultural_category, Publication.location, Publication.end_date, Publication.link,
            Publication.tagline, Publication.tags, Opportunity.organizer, Opportunity.audience, Opportunity.prize,
            Opportunity.requirements, OpportunityType.slug.label("type_slug"), OpportunityType.label.label("type_label"),
            OpportunityType.color.label("type_color"))


def _item(row, cover, closed: bool) -> dict:
    category = row.cultural_category if cover.valid(row.cultural_category) else None
    item = {
        "id": row.id, "title": row.title, "summary": row.summary,
        "image": row.image if row.image and _IMAGE_URL.match(row.image) else cover(category),
        "municipality": row.municipality if row.municipality in MUNICIPALITY_LABELS else None,
        "municipality_label": MUNICIPALITY_LABELS.get(row.municipality),
        "cultural_category": category_slug(category) if category else None,
        "category_label": cover.label(category),
        "type": {"slug": row.type_slug, "label": row.type_label, "color": row.type_color} if row.type_slug else None,
        "organizer": row.organizer, "audience": row.audience, "prize": row.prize,
        "requirements": list(row.requirements or []),
        "end_date": row.end_date.isoformat() if row.end_date else None,
        "location": (row.location or "").strip() or None,
        "link": row.link or None,
        "closed": closed,
    }
    if row.tagline:
        item["tagline"] = row.tagline
    if row.tags:
        item["tags"] = list(row.tags)
    return item


def build_opportunities(db: Session, municipality: str | None = None, type_slug: str | None = None,
                        category: str | None = None, soon: bool = False, offset: int = 0,
                        today: date | None = None) -> dict:
    """municipality: slug de los 6; type_slug: slug de un tipo; category: clave (MUSICA...). La ruta ya
    los valido."""
    today = today or today_bogota()
    start_of_today = datetime.combine(today, time.min)
    closes = Publication.end_date
    blocks = {
        "open": closes >= start_of_today,
        "open_ended": closes.is_(None),
        "closed": closes < start_of_today,
    }
    if soon:
        blocks["open"] = (closes >= start_of_today) & (closes < start_of_today + timedelta(days=SOON_DAYS + 1))

    conditions = [Publication.status == "PUBLISHED", Publication.deleted.is_(False), Publication.kind == "OPORTUNIDAD"]
    if municipality:
        conditions.append(Publication.municipality == municipality)
    if category:
        conditions.append(Publication.cultural_category == category)
    if type_slug:
        conditions.append(OpportunityType.slug == type_slug)

    def base(*columns):
        return (select(*columns).select_from(Publication)
                .join(Opportunity, Opportunity.publication_id == Publication.id, isouter=True)
                .join(OpportunityType, OpportunityType.id == Opportunity.type_id, isouter=True)
                .where(*conditions))

    names = ["open"] if soon else ["open", "open_ended", "closed"]
    counts = dict.fromkeys(("open", "open_ended", "closed"), 0)
    counts.update(zip(names, db.execute(base(*(func.count().filter(blocks[name]) for name in names))).one()))

    orders = {
        "open": (closes.asc(), Publication.id.asc()),
        "open_ended": (Publication.created_at.desc(), Publication.id.desc()),
        "closed": (closes.desc(), Publication.id.desc()),
    }
    limits = {"open": OPEN_LIMIT, "open_ended": OPEN_ENDED_LIMIT, "closed": CLOSED_PAGE}
    cover = category_cover_lookup(db)
    result = {"today": today.isoformat(), "open": [], "open_ended": [], "closed": []}
    for name in names:
        stmt = base(*_COLUMNS).where(blocks[name]).order_by(*orders[name]).limit(limits[name])
        if name == "closed":
            stmt = stmt.offset(offset)
        result[name] = [_item(row, cover, closed=name == "closed") for row in db.execute(stmt).all()]
    result["counts"] = counts
    next_offset = offset + len(result["closed"])
    result["closed_next_offset"] = next_offset if not soon and next_offset < counts["closed"] else None
    return result
