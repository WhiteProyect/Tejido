"""Puntos del Mapa vivo (GET /api/map/points): EVENTOS y LUGARES con el mismo payload generico (key, type,
id, title, summary, image, municipality(_label), cultural_category, category_label, location, start_date,
end_date, tradition_text, lat, lng, href). Los lugares suman place_category ({slug, label, icon, color} o
None en un lugar antiguo sin completar), address, phone, whatsapp, opening_hours y website.

Un evento entra si esta publicado, sin borrar, con punto y vigente: termina hoy o despues (end_date o,
si no hay, start_date; "hoy" es el dia de Bogota, home_carousel.today_bogota, igual que la Agenda) o
es de tradicion (sin fecha, o con texto de tradicion: vuelve cada año). Un lugar entra si esta
publicado, sin borrar y con punto, tenga o no categoria cultural; no caduca por fecha. Solo campos
publicos. Tope: EVENTS_LIMIT eventos y PLACES_LIMIT lugares por respuesta.
"""
from datetime import date, datetime, time

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.service.models.tables import Place, PlaceCategory, Publication
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS, category_slug
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services.agenda import _IMAGE_URL
from backend.service.services.home_carousel import _cover_lookup as category_cover_lookup, _summary, today_bogota

EVENTS_LIMIT = 500
PLACES_LIMIT = 500
POINTS_LIMIT = EVENTS_LIMIT + PLACES_LIMIT
SUMMARY_LIMIT = 140


def _common(row, cover, type_: str) -> dict:
    category = row.cultural_category if row.cultural_category in CULTURAL_CATEGORIES else None
    return {
        "key": f"{type_.lower()}-{row.id}", "type": type_, "id": row.id, "title": row.title,
        "summary": _summary(row.summary or "", SUMMARY_LIMIT) or None,
        "image": row.image if row.image and _IMAGE_URL.match(row.image) else cover(category),
        "municipality": row.municipality if row.municipality in MUNICIPALITY_LABELS else None,
        "municipality_label": MUNICIPALITY_LABELS.get(row.municipality),
        "cultural_category": category_slug(category) if category else None,
        "category_label": CULTURAL_CATEGORY_LABELS.get(category),
        "location": (row.location or "").strip() or None,
        "lat": float(row.latitude), "lng": float(row.longitude),
        "href": f"#publicacion/{row.id}",
    }


def _event_point(row, cover) -> dict:
    point = _common(row, cover, "EVENTO")
    point.update(start_date=row.start_date.isoformat() if row.start_date else None,
                 end_date=row.end_date.isoformat() if row.end_date else None,
                 tradition_text=row.tradition_text)
    return point


def _place_point(row, cover) -> dict:
    point = _common(row, cover, "LUGAR")
    point.update(start_date=None, end_date=None, tradition_text=None,
                 place_category=({"slug": row.category_slug, "label": row.category_label_place, "icon": row.category_icon,
                                  "color": row.category_color} if row.category_slug else None),
                 address=point["location"], phone=row.phone, whatsapp=row.whatsapp,
                 opening_hours=row.opening_hours, website=row.website)
    return point


_BASE_COLUMNS = (Publication.id, Publication.title, Publication.summary, Publication.image, Publication.municipality,
                 Publication.cultural_category, Publication.location, Publication.latitude, Publication.longitude)


def _visible(municipality: str | None, kind: str) -> list:
    conditions = [Publication.status == "PUBLISHED", Publication.deleted.is_(False), Publication.kind == kind,
                  Publication.latitude.is_not(None), Publication.longitude.is_not(None)]
    if municipality:
        conditions.append(Publication.municipality == municipality)
    return conditions


def build_map_points(db: Session, municipality: str | None = None, today: date | None = None) -> dict:
    """municipality: slug de los 6 (la ruta ya lo valido). Primero los eventos (por fecha), luego los
    lugares (por titulo)."""
    today = today or today_bogota()
    start_of_today = datetime.combine(today, time.min)
    ends = func.coalesce(Publication.end_date, Publication.start_date)
    events = db.execute(
        select(*_BASE_COLUMNS, Publication.start_date, Publication.end_date, Publication.tradition_text)
        .where(*_visible(municipality, "EVENTO"),
               or_(ends >= start_of_today, Publication.start_date.is_(None), Publication.tradition_text.is_not(None)))
        .order_by(Publication.start_date.asc().nulls_last(), Publication.id.asc())
        .limit(EVENTS_LIMIT)
    ).all()
    places = db.execute(
        select(*_BASE_COLUMNS, PlaceCategory.slug.label("category_slug"), PlaceCategory.label.label("category_label_place"),
               PlaceCategory.icon.label("category_icon"), PlaceCategory.color.label("category_color"),
               Place.phone, Place.whatsapp, Place.opening_hours, Place.website)
        .join(Place, Place.publication_id == Publication.id, isouter=True)
        .join(PlaceCategory, PlaceCategory.id == Place.place_category_id, isouter=True)
        .where(*_visible(municipality, "LUGAR"))
        .order_by(func.lower(Publication.title).asc(), Publication.id.asc())
        .limit(PLACES_LIMIT)
    ).all()
    cover = category_cover_lookup(db)
    return {"today": today.isoformat(),
            "points": [_event_point(row, cover) for row in events] + [_place_point(row, cover) for row in places]}
