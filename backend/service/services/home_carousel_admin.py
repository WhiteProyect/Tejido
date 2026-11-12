"""Carrusel del inicio elegido por el admin (/api/admin/home-carousel): leer, guardar, buscar candidatos y volver
a automatico. El armado y las reglas de vigencia viven en services/home_carousel.py (las mismas para el
publico y para la vista previa del panel)."""
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import Artist, HomeCarouselPick, HomeCarouselSettings, Publication, TalentProfile
from backend.service.services import artists as artist_service
from backend.service.services import home_carousel as hc
from backend.service.services.auth import now_utc

CANDIDATES_PAGE = 10
MAX_PICKS = 60
LIMIT_LABELS = {"content_limit": "contenido", "moneystack_limit": "artistas de Moneystack", "tejido_limit": "artistas de TEJIDO"}
SELLO_LABELS = {hc.SELLO_MONEYSTACK: "Moneystack", hc.SELLO_TEJIDO: "TEJIDO"}


def _item(kind: str, row, cover, state=None, reason=None, sello=None) -> dict:
    """Fila del panel: lo necesario para reconocer el elemento (sin autores ni datos de moderacion)."""
    if kind == "PUBLICATION":
        data = {"type": kind, "id": row.id, "title": row.title, "kind": row.kind, "kind_label": hc.KIND_LABELS.get(row.kind, row.kind),
                "branch": row.cultural_category, "branch_label": cover.label(row.cultural_category), "image": hc.publication_image(row, cover)}
    elif kind == "TALENT":
        data = {"type": kind, "id": row.id, "title": row.name, "kind": "TALENT", "kind_label": "Talento",
                "branch": row.category, "branch_label": cover.label(row.category), "image": hc.talent_image(row, cover)}
    else:
        sello = sello or (hc.SELLO_MONEYSTACK if row.moneystack else hc.SELLO_TEJIDO)
        data = {"type": kind, "id": row.id, "title": row.stage_name, "kind": "ARTIST", "kind_label": "Artista",
                "sello": sello, "sello_label": SELLO_LABELS[sello], "genre": row.genre, "image": row.image or cover(hc.ARTIST_BRANCH)}
    if state:
        data.update(status=state, reason=reason)
    return data


def overview(db: Session) -> dict:
    composed = hc.compose(db)
    cover = hc._cover_lookup(db)
    return {
        "settings": composed["settings"],
        "content": [_item(entry["kind"], entry["row"], cover, entry["state"], entry["reason"]) for entry in composed["content"]],
        "artists": [_item("ARTIST", entry["row"], cover, entry["state"], entry["reason"], entry["sello"]) for entry in composed["artists"]],
        "preview": composed["slides"],
        "defaults": hc.DEFAULT_LIMITS,
        "ranges": hc.LIMIT_RANGES,
    }


# ─────────────────────────── guardar ───────────────────────────

def _int(value):
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _clean_settings(raw) -> dict:
    if not isinstance(raw, dict):
        raise AppError(422, "INVALID_SETTINGS", "Faltan las cantidades del carrusel")
    settings = {}
    for key, (low, high) in hc.LIMIT_RANGES.items():
        value = _int(raw.get(key))
        if value is None or not low <= value <= high:
            raise AppError(422, "INVALID_SETTINGS", f"La cantidad de {LIMIT_LABELS[key]} debe ser un número entre {low} y {high}")
        settings[key] = value
    if not sum(settings.values()):
        raise AppError(422, "EMPTY_CAROUSEL", "El carrusel no puede quedar vacío: sube alguna de las cantidades")
    return settings


def _clean_list(raw, section: str) -> list[tuple[str, int]]:
    if not isinstance(raw, list):
        raise AppError(422, "INVALID_LIST", f"La lista de {section} no es válida")
    if len(raw) > MAX_PICKS:
        raise AppError(422, "INVALID_LIST", f"La lista de {section} admite hasta {MAX_PICKS} elementos")
    allowed = ("PUBLICATION", "TALENT") if section == "contenido" else ("ARTIST",)
    items = []
    for entry in raw:
        kind = entry.get("type") if isinstance(entry, dict) else None
        item_id = _int(entry.get("id")) if isinstance(entry, dict) else None
        if kind not in allowed or not item_id or item_id < 1:
            raise AppError(422, "INVALID_ITEM", f"Hay un elemento no válido en la lista de {section}")
        items.append((kind, item_id))
    if len(set(items)) != len(items):
        raise AppError(422, "DUPLICATE_ITEM", f"Hay elementos repetidos en la lista de {section}: cada uno va una sola vez")
    return items


def _require_existing(db: Session, items: list[tuple[str, int]]) -> None:
    models = {"PUBLICATION": Publication, "TALENT": TalentProfile, "ARTIST": Artist}
    names = {"PUBLICATION": "publicación", "TALENT": "perfil de talento", "ARTIST": "artista"}
    for kind, model in models.items():
        wanted = {item_id for k, item_id in items if k == kind}
        if not wanted:
            continue
        found = set(db.execute(select(model.id).where(model.id.in_(wanted))).scalars())
        missing = sorted(wanted - found)
        if missing:
            raise AppError(422, "ITEM_NOT_FOUND", f"Ya no existe: {names[kind]} {', '.join(map(str, missing))}. Recarga el panel")


def _write_settings(db: Session, settings: dict) -> None:
    values = {**settings, "updated_at": now_utc()}
    db.execute(pg_insert(HomeCarouselSettings).values(id=1, **values)
               .on_conflict_do_update(index_elements=["id"], set_=values))


def save(db: Session, payload) -> None:
    """Las dos listas ordenadas y las cantidades, en una sola operacion (quien llama hace el commit)."""
    if not isinstance(payload, dict):
        raise AppError(422, "INVALID_BODY", "Faltan los datos del carrusel")
    settings = _clean_settings(payload.get("settings"))
    content = _clean_list(payload.get("content", []), "contenido")
    artists = _clean_list(payload.get("artists", []), "artistas")
    _require_existing(db, content + artists)
    db.execute(delete(HomeCarouselPick))
    column = {"PUBLICATION": "publication_id", "TALENT": "talent_id", "ARTIST": "artist_id"}
    for items in (content, artists):
        for position, (kind, item_id) in enumerate(items):
            db.add(HomeCarouselPick(position=position, **{column[kind]: item_id}))
    _write_settings(db, settings)
    db.flush()


def reset(db: Session) -> None:
    """Volver a automatico: sin elegidos y con las cantidades por defecto."""
    db.execute(delete(HomeCarouselPick))
    _write_settings(db, dict(hc.DEFAULT_LIMITS))
    db.flush()


# ─────────────────────────── candidatos ───────────────────────────

def _page(value, default=0) -> int:
    try:
        return max(int(value), 0)
    except (TypeError, ValueError):
        return default


def candidates(db: Session, section: str, kind=None, category=None, sello=None, q=None, offset=0) -> dict:
    """Publicados y vigentes que todavia no estan elegidos, de a CANDIDATES_PAGE (paginacion con offset)."""
    cover = hc._cover_lookup(db)
    q = str(q or "").strip()[:80]
    offset = _page(offset)
    picks = db.execute(select(HomeCarouselPick)).scalars().all()
    if section == "artists":
        if sello and sello not in ("moneystack", "tejido"):
            raise AppError(422, "INVALID_FILTER", "El sello debe ser moneystack o tejido")
        conditions = [*artist_service.public_conditions(), Artist.id.not_in([p.artist_id for p in picks if p.artist_id] or [0])]
        if sello:
            conditions.append(Artist.moneystack.is_(artist_service.SELLOS[sello]))
        if q:
            conditions.append(or_(Artist.stage_name.ilike(f"%{q}%"), Artist.name.ilike(f"%{q}%")))
        total = db.execute(select(func.count()).select_from(Artist).where(*conditions)).scalar()
        rows = db.execute(select(Artist).where(*conditions).order_by(Artist.featured.desc(), Artist.name, Artist.id)
                          .offset(offset).limit(CANDIDATES_PAGE)).scalars().all()
        items = [_item("ARTIST", row, cover, *hc._artist_state(row)) for row in rows]
        return _paged(items, total, offset)
    if section != "content":
        raise AppError(422, "INVALID_FILTER", "La sección debe ser content o artists")

    kind = str(kind or "").strip().upper()
    if kind and kind not in (*hc.CONTENT_KINDS, "TALENT"):
        raise AppError(422, "INVALID_FILTER", "Ese tipo de contenido no existe")
    category = str(category or "").strip().upper()
    if category and not cover.is_active(category):
        raise AppError(422, "INVALID_FILTER", "Esa rama no existe o está desactivada")
    today = hc.today_bogota()
    found = []
    if kind != "TALENT":
        conditions = [hc.publication_published(), hc.publication_current(today),
                      or_(Publication.cultural_category.is_(None), Publication.cultural_category.in_(cover.active_keys)),
                      Publication.id.not_in([p.publication_id for p in picks if p.publication_id] or [0])]
        if kind:
            conditions.append(Publication.kind == kind)
        if category:
            conditions.append(Publication.cultural_category == category)
        if q:
            conditions.append(Publication.title.ilike(f"%{q}%"))
        rows = db.execute(select(*hc._PUB_COLUMNS, Publication.status, Publication.deleted, hc.publication_current(today).label("current"))
                          .where(*conditions).order_by(Publication.created_at.desc(), Publication.id.desc())
                          .limit(offset + CANDIDATES_PAGE + 1)).all()
        found += [(row.created_at, _item("PUBLICATION", row, cover, *hc._publication_state(row, cover))) for row in rows]
        pub_total = db.execute(select(func.count()).select_from(Publication).where(*conditions)).scalar()
    else:
        pub_total = 0
    talent_total = 0
    if not kind or kind == "TALENT":
        conditions = [hc.talent_published(), TalentProfile.category.in_(cover.active_keys),
                      TalentProfile.id.not_in([p.talent_id for p in picks if p.talent_id] or [0])]
        if category:
            conditions.append(TalentProfile.category == category)
        if q:
            conditions.append(TalentProfile.name.ilike(f"%{q}%"))
        rows = db.execute(select(*hc._TALENT_COLUMNS, TalentProfile.status, TalentProfile.deleted)
                          .where(*conditions).order_by(TalentProfile.created_at.desc(), TalentProfile.id.desc())
                          .limit(offset + CANDIDATES_PAGE + 1)).all()
        found += [(row.created_at, _item("TALENT", row, cover, *hc._talent_state(row, cover))) for row in rows]
        talent_total = db.execute(select(func.count()).select_from(TalentProfile).where(*conditions)).scalar()
    found.sort(key=lambda pair: pair[0], reverse=True)
    items = [item for _, item in found[offset:offset + CANDIDATES_PAGE]]
    return _paged(items, pub_total + talent_total, offset)


def _paged(items: list, total: int, offset: int) -> dict:
    next_offset = offset + len(items)
    return {"items": items, "total": total, "next_offset": next_offset if next_offset < total else None}
