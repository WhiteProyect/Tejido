"""Carrusel del landing (GET /api/home/carousel): contenido intercalado con artistas.

El admin elige (tabla home_carousel_picks, /api/admin/home-carousel) que contenido y que artistas salen y en
que orden, y fija las cantidades (home_carousel_settings: contenido 0-12, Moneystack 0-6 y TEJIDO 0-6; sin
fila, 10 / 3 / 3). Lo elegido sale primero, en su orden; lo que falte lo completa la logica automatica:

- Contenido: UNA publicacion por rama activa sin un elegido (la destacada o, si no hay, la mas reciente) y
  UN talento si no se eligio ninguno, ordenados por (destacado, recencia). Nunca repite lo elegido.
- Artistas: hasta la cuota de cada sello. Moneystack y TEJIDO en el orden de list_artists (destacados
  primero y luego por nombre); el relleno alterna los dos sellos, empezando por Moneystack.

La vigencia se calcula al leer, con las mismas reglas para lo elegido y para el relleno (dia de Bogota): un
evento sale cuando pasa su ultimo dia, una oportunidad cuando pasa su cierre; lo no publicado o borrado, el
artista archivado o no publicado, la rama desactivada y lo que no tiene imagen se saltan. La eleccion queda
guardada: si vuelve a valer (p. ej. se extiende el cierre), reaparece sola.

Orden final: [contenido, bloque de artistas, contenido, ...]. Cada artista sale una vez y los artistas se
reparten parejo detras del contenido (con mas artistas que contenido, varios por bloque). Sin artistas,
solo contenido; sin contenido, solo artistas.
Cada diapositiva lleva solo campos publicos (nada de autores, correos, ids de usuario ni moderacion)
y solo los datos que existan: lo que la publicacion no tiene no viaja.
"""
import re
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from backend.service.models.tables import Artist, HomeCarouselPick, HomeCarouselSettings, Publication, TalentProfile
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services import artists as artist_service
from backend.service.services import cultural_branches

SUMMARY_LIMIT = 240
# Del contenido (cuando falta el resumen) solo se leen estos caracteres de la base.
EXCERPT_SOURCE = 600
PUBLICATION_TAGS_SHOWN = 2
# Tipo legado: los perfiles de talento viven en talent_profiles.
EXCLUDED_KINDS = ("TALENTO",)
# Tipos de publicacion que pueden ir al carrusel.
CONTENT_KINDS = ("HISTORIA", "EVENTO", "OPORTUNIDAD", "INICIATIVA", "LUGAR")
# Cantidades por defecto y sus rangos (los mismos CHECK de home_carousel_settings).
DEFAULT_LIMITS = {"content_limit": 10, "moneystack_limit": 3, "tejido_limit": 3}
LIMIT_RANGES = {"content_limit": (0, 12), "moneystack_limit": (0, 6), "tejido_limit": (0, 6)}
# Los artistas no tienen rama: su portada de respaldo es la de Musica.
ARTIST_BRANCH = "MUSICA"
# Bogota no tiene horario de verano: UTC-5 fijo (sin depender de tzdata).
BOGOTA = timezone(timedelta(hours=-5), "America/Bogota")

# Los mismos textos de KIND_LABELS en frontend/src/utils/constants.js.
KIND_LABELS = {
    "HISTORIA": "Historia", "EVENTO": "Evento", "OPORTUNIDAD": "Oportunidad",
    "INICIATIVA": "Iniciativa", "LUGAR": "Lugar", "TALENT": "Talento",
}
# Boton de cada tipo de diapositiva.
CTA_BY_KIND = {
    "EVENTO": "Ver evento", "OPORTUNIDAD": "Ver convocatoria", "HISTORIA": "Leer historia",
    "INICIATIVA": "Conocer iniciativa", "LUGAR": "Ver lugar", "TALENT": "Ver perfil",
}
BADGE_SEPARATOR = " · "

# Carta del artista. Moneystack: la de siempre. TEJIDO: su insignia y genero, municipio y "Musica".
ARTIST_BADGE = "Artista destacado"
ARTIST_TAGS = ("Moneystack", "Bajo Cauca", "Música Urbana")
TEJIDO_ARTIST_BADGE = "Artista de TEJIDO"
TEJIDO_ARTIST_TAG = "Música"
ARTIST_CTA = "Ver perfil"
ARTIST_SUMMARY_LIMIT = 180
ARTIST_FIELDS = ("slug", "stage_name", "bio", "image", "genre", "city", "region",
                 "spotify_url", "youtube_url", "instagram_url", "tiktok_url")
TRACK_FIELDS = ("title", "duration", "spotify_url", "youtube_url")
SELLO_MONEYSTACK, SELLO_TEJIDO = "MONEYSTACK", "TEJIDO"

# Estado de cada elegido (panel del admin), con su motivo.
VISIBLE = "VISIBLE"
OUT_OF_DATE = "FUERA_DE_VIGENCIA"
NOT_PUBLISHED = "NO_PUBLICADO"
BRANCH_OFF = "RAMA_DESACTIVADA"
NO_IMAGE = "SIN_IMAGEN"
OVER_LIMIT = "FUERA_DEL_LIMITE"

_TAGS = re.compile(r"<[^>]*>")


def _plain(text) -> str:
    return " ".join(_TAGS.sub(" ", str(text or "")).split())


def _summary(text, limit=SUMMARY_LIMIT) -> str:
    plain = _plain(text)
    return plain if len(plain) <= limit else plain[: limit - 1].rstrip() + "…"


def today_bogota() -> date:
    return datetime.now(BOGOTA).date()


def _cover_lookup(db: Session):
    """Ramas de la tabla para armar tarjetas: cover(clave) da la portada (la de la base, o la estatica de las
    10 iniciales; None si no es una rama); .valid(clave) y .label(clave) sirven para el resto."""
    return cultural_branches.BranchLookup(db)


def _present(**fields):
    """Solo los campos con dato (sin None, cadenas vacias ni listas vacias)."""
    return {key: value for key, value in fields.items() if value not in (None, "", [], ())}


# ─────────────────────────── reglas de vigencia (elegidos y relleno) ───────────────────────────

def publication_published():
    """Publicada, sin borrar y de un tipo que va al carrusel."""
    return and_(Publication.status == "PUBLISHED", Publication.deleted.is_(False), Publication.kind.in_(CONTENT_KINDS))


def publication_current(today: date):
    """Vigencia (dia de Bogota): un evento sale cuando pasa su ultimo dia (end_date o, si no hay, start_date);
    una oportunidad, cuando pasa su cierre. Sin fecha, entra."""
    start_of_today = datetime.combine(today, time.min)
    last_day = func.coalesce(Publication.end_date, Publication.start_date)
    return and_(
        or_(Publication.kind != "EVENTO", last_day.is_(None), last_day >= start_of_today),
        or_(Publication.kind != "OPORTUNIDAD", Publication.end_date.is_(None), Publication.end_date >= start_of_today),
    )


def talent_published():
    return and_(TalentProfile.status == "PUBLISHED", TalentProfile.deleted.is_(False))


def load_settings(db: Session) -> dict:
    row = db.get(HomeCarouselSettings, 1)
    return {key: getattr(row, key) for key in DEFAULT_LIMITS} if row else dict(DEFAULT_LIMITS)


# ─────────────────────────── diapositivas ───────────────────────────

_PUB_COLUMNS = (
    Publication.id, Publication.kind, Publication.title, Publication.summary,
    func.substr(Publication.content, 1, EXCERPT_SOURCE).label("excerpt"), Publication.image,
    Publication.cultural_category, Publication.municipality, Publication.location,
    Publication.start_date, Publication.end_date, Publication.tagline, Publication.tags,
    Publication.featured, Publication.created_at,
)
_TALENT_COLUMNS = (
    TalentProfile.id, TalentProfile.slug, TalentProfile.name, TalentProfile.tagline,
    TalentProfile.description, TalentProfile.cover_url, TalentProfile.category, TalentProfile.origin,
    TalentProfile.featured, TalentProfile.published_at, TalentProfile.created_at,
)


def _content_slide(slide_type, kind, key, title, summary, image, municipality, category_label, href, recency,
                   featured, tags=(), **extra):
    kind_label = KIND_LABELS.get(kind, kind.title())
    badge = BADGE_SEPARATOR.join(part for part in (kind_label, municipality) if part)
    # La categoria primero y despues hasta dos etiquetas de la publicacion que no la repitan.
    slide_tags = [category_label] if category_label else []
    own = [tag for tag in tags if tag and tag.casefold() != (category_label or "").casefold()]
    slide_tags += own[:PUBLICATION_TAGS_SHOWN]
    slide = {"type": slide_type, "key": key, "kind": kind, "title": title, "summary": _summary(summary), "image": image,
             "badge": badge, "tags": slide_tags, "href": href, "cta_label": CTA_BY_KIND[kind],
             **_present(municipality=municipality, category_label=category_label, **extra)}
    # Para ordenar el relleno; no viaja.
    slide["_order"] = (bool(featured), recency)
    return slide


def publication_image(row, cover):
    return row.image or cover(row.cultural_category)


def talent_image(row, cover):
    return row.cover_url or cover(row.category)


def _publication_slide(row, cover):
    return _content_slide(
        "PUBLICATION", row.kind, f"publication-{row.id}", row.title, row.summary or row.excerpt,
        publication_image(row, cover), MUNICIPALITY_LABELS.get(row.municipality),
        cover.label(row.cultural_category), f"#publicacion/{row.id}",
        row.created_at, row.featured, tags=row.tags or (),
        tagline=(row.tagline or "").strip() or None,
        location=(row.location or "").strip() or None,
        start_date=row.start_date.isoformat() if row.start_date else None,
        end_date=row.end_date.isoformat() if row.end_date else None,
    )


def _talent_slide(row, cover):
    tagline = (row.tagline or "").strip() or None
    return _content_slide(
        "TALENT", "TALENT", f"talent-{row.id}", row.name, row.description or tagline, talent_image(row, cover),
        MUNICIPALITY_LABELS.get(row.origin), cover.label(row.category), f"#talento/{row.slug}",
        row.published_at or row.created_at, row.featured, tagline=tagline,
    )


def _auto_publications(db: Session, cover, today: date, skip_branches: set, skip_ids: set):
    """Relleno: una por rama activa que no tenga ya un elegido, sin repetir lo elegido."""
    branches = [key for key in cover.active_keys if key not in skip_branches]
    if not branches:
        return []
    conditions = [publication_published(), publication_current(today), Publication.cultural_category.in_(branches)]
    if skip_ids:
        conditions.append(Publication.id.not_in(skip_ids))
    rows = db.execute(
        # Postgres: DISTINCT ON se queda con la primera fila de cada categoria segun el ORDER BY.
        select(*_PUB_COLUMNS).where(*conditions)
        .distinct(Publication.cultural_category)
        .order_by(Publication.cultural_category, Publication.featured.desc(), Publication.created_at.desc(),
                  Publication.id.desc())
    ).all()
    return [_publication_slide(row, cover) for row in rows if publication_image(row, cover)]


def _auto_talent(db: Session, cover, skip_ids: set):
    """Relleno: el primer talento publicado (destacado y mas reciente primero) con imagen y de una rama activa."""
    conditions = [talent_published(), TalentProfile.category.in_(cover.active_keys)]
    if skip_ids:
        conditions.append(TalentProfile.id.not_in(skip_ids))
    rows = db.execute(
        select(*_TALENT_COLUMNS).where(*conditions)
        .order_by(TalentProfile.featured.desc(), TalentProfile.published_at.desc().nulls_last(), TalentProfile.id.desc())
        .limit(6)
    ).all()
    for row in rows:
        if talent_image(row, cover):
            return [_talent_slide(row, cover)]
    return []


def sello_of(artist: dict) -> str:
    return SELLO_MONEYSTACK if artist.get("moneystack", True) else SELLO_TEJIDO


def _artist_slide(db: Session, artist: dict, cover):
    image = artist.get("image") or cover(ARTIST_BRANCH)
    track = artist_service.get_featured_track(db, artist["id"])
    sello = sello_of(artist)
    if sello == SELLO_MONEYSTACK:
        badge, tags = ARTIST_BADGE, list(ARTIST_TAGS)
    else:
        badge = TEJIDO_ARTIST_BADGE
        tags = [tag for tag in ((artist.get("genre") or "").strip(), MUNICIPALITY_LABELS.get(artist.get("municipality")),
                                TEJIDO_ARTIST_TAG) if tag]
    return {
        "type": "ARTIST", "key": f"artist-{artist['id']}", "title": artist["stage_name"],
        "summary": _summary(artist.get("bio"), ARTIST_SUMMARY_LIMIT), "image": image, "badge": badge, "tags": tags,
        "href": f"#artista/{artist['slug']}" if artist.get("slug") else ("#moneystack" if sello == SELLO_MONEYSTACK else "#artistas"),
        "cta_label": ARTIST_CTA,
        "artist": {field: artist.get(field) for field in ARTIST_FIELDS},
        "featured_track": {field: track.get(field) for field in TRACK_FIELDS} if track else None,
        "sello": sello,
    }


def _spread(content: list, artists: list) -> list:
    """[contenido, artistas...] con los artistas repartidos parejo detras del contenido: el artista i va
    detras de la diapositiva floor(i * huecos / artistas). Con mas artistas que contenido, los primeros
    bloques llevan uno de mas."""
    if not content:
        return list(artists)
    blocks = [[] for _ in content]
    for index, artist in enumerate(artists):
        blocks[index * len(content) // len(artists)].append(artist)
    slides = []
    for slide, block in zip(content, blocks):
        slides += [slide] + block
    return slides


# ─────────────────────────── composicion ───────────────────────────

def _limit_reason(kind: str, limit: int) -> str:
    return {"content": f"Pasa del límite de contenido ({limit})",
            SELLO_MONEYSTACK: f"Pasa del límite de artistas de Moneystack ({limit})",
            SELLO_TEJIDO: f"Pasa del límite de artistas de TEJIDO ({limit})"}[kind]


_NOT_PUBLISHED = {"DRAFT": "Está en borrador", "REVIEW": "Está en revisión", "REJECTED": "Fue rechazada"}


def _publication_state(row, cover) -> tuple[str, str]:
    if row.deleted:
        return NOT_PUBLISHED, "Se eliminó"
    if row.kind not in CONTENT_KINDS:
        return NOT_PUBLISHED, "Este tipo de publicación no va al carrusel"
    if row.status != "PUBLISHED":
        return NOT_PUBLISHED, _NOT_PUBLISHED.get(row.status, "No está publicada")
    if row.cultural_category and not cover.is_active(row.cultural_category):
        return BRANCH_OFF, f"La rama {cover.label(row.cultural_category) or row.cultural_category} está desactivada"
    if not row.current:
        return OUT_OF_DATE, "El evento ya pasó" if row.kind == "EVENTO" else "La convocatoria cerró"
    if not publication_image(row, cover):
        return NO_IMAGE, "No tiene imagen ni portada de rama"
    return VISIBLE, "Sale en el carrusel"


def _talent_state(row, cover) -> tuple[str, str]:
    if row.deleted:
        return NOT_PUBLISHED, "Se eliminó"
    if row.status != "PUBLISHED":
        return NOT_PUBLISHED, {"DRAFT": "Está en borrador", "REVIEW": "Está en revisión", "REJECTED": "Fue rechazado"}.get(
            row.status, "No está publicado")
    if not cover.is_active(row.category):
        return BRANCH_OFF, f"La rama {cover.label(row.category) or row.category} está desactivada"
    if not talent_image(row, cover):
        return NO_IMAGE, "No tiene portada"
    return VISIBLE, "Sale en el carrusel"


def _artist_state(artist: Artist) -> tuple[str, str]:
    if not artist.active:
        return NOT_PUBLISHED, "El artista está archivado"
    if artist.status != "PUBLISHED":
        return NOT_PUBLISHED, "El artista está en revisión" if artist.status == "REVIEW" else "El artista fue rechazado"
    return VISIBLE, "Sale en el carrusel"


def compose(db: Session, today: date | None = None) -> dict:
    """El carrusel y, para el panel del admin, el estado de cada elegido.
    {"slides": [...], "settings": {...}, "content": [{pick, kind, row, state, reason}], "artists": [...]}"""
    today = today or today_bogota()
    cover = _cover_lookup(db)
    settings = load_settings(db)
    picks = db.execute(select(HomeCarouselPick).order_by(HomeCarouselPick.position, HomeCarouselPick.id)).scalars().all()

    pub_ids = [p.publication_id for p in picks if p.publication_id]
    talent_ids = [p.talent_id for p in picks if p.talent_id]
    artist_ids = [p.artist_id for p in picks if p.artist_id]
    pub_rows = {row.id: row for row in db.execute(
        select(*_PUB_COLUMNS, Publication.status, Publication.deleted, publication_current(today).label("current"))
        .where(Publication.id.in_(pub_ids))).all()} if pub_ids else {}
    talent_rows = {row.id: row for row in db.execute(
        select(*_TALENT_COLUMNS, TalentProfile.status, TalentProfile.deleted).where(TalentProfile.id.in_(talent_ids))).all()} if talent_ids else {}
    artist_rows = {row.id: row for row in db.execute(select(Artist).where(Artist.id.in_(artist_ids))).scalars()} if artist_ids else {}

    # Contenido elegido, en su orden, hasta el limite.
    content_states, chosen = [], []
    for pick in (p for p in picks if not p.artist_id):
        if pick.publication_id:
            kind, row = "PUBLICATION", pub_rows[pick.publication_id]
            state, reason = _publication_state(row, cover)
        else:
            kind, row = "TALENT", talent_rows[pick.talent_id]
            state, reason = _talent_state(row, cover)
        slide = None
        if state == VISIBLE:
            if len(chosen) >= settings["content_limit"]:
                state, reason = OVER_LIMIT, _limit_reason("content", settings["content_limit"])
            else:
                slide = _publication_slide(row, cover) if kind == "PUBLICATION" else _talent_slide(row, cover)
                chosen.append((kind, row, slide))
        content_states.append({"pick": pick, "kind": kind, "row": row, "state": state, "reason": reason})

    # Relleno de contenido: ramas sin elegido y un talento si no se eligio ninguno.
    room = settings["content_limit"] - len(chosen)
    auto = []
    if room > 0:
        covered = {row.cultural_category for kind, row, _ in chosen if kind == "PUBLICATION" and row.cultural_category}
        auto = _auto_publications(db, cover, today, covered, set(pub_ids))
        if not any(kind == "TALENT" for kind, _, _ in chosen):
            auto += _auto_talent(db, cover, set(talent_ids))
        auto.sort(key=lambda slide: slide["_order"], reverse=True)
        auto = auto[:room]
    content = [slide for _, _, slide in chosen] + auto
    for slide in content:
        del slide["_order"]

    # Artistas elegidos (orden global de su lista) con la cuota de cada sello; luego el relleno.
    quota = {SELLO_MONEYSTACK: settings["moneystack_limit"], SELLO_TEJIDO: settings["tejido_limit"]}
    used = {SELLO_MONEYSTACK: 0, SELLO_TEJIDO: 0}
    artist_states, artists = [], []
    for pick in (p for p in picks if p.artist_id):
        row = artist_rows[pick.artist_id]
        sello = SELLO_MONEYSTACK if row.moneystack else SELLO_TEJIDO
        state, reason = _artist_state(row)
        if state == VISIBLE:
            if used[sello] >= quota[sello]:
                state, reason = OVER_LIMIT, _limit_reason(sello, quota[sello])
            else:
                used[sello] += 1
                artists.append(artist_service._public_dict(row))
        artist_states.append({"pick": pick, "kind": "ARTIST", "row": row, "sello": sello, "state": state, "reason": reason})
    fill = {}
    for sello, api_sello in ((SELLO_MONEYSTACK, "moneystack"), (SELLO_TEJIDO, "tejido")):
        room = quota[sello] - used[sello]
        fill[sello] = [a for a in artist_service.list_artists(db, sello=api_sello) if a["id"] not in artist_ids][:max(room, 0)]
    for index in range(max(len(fill[SELLO_MONEYSTACK]), len(fill[SELLO_TEJIDO]))):
        for sello in (SELLO_MONEYSTACK, SELLO_TEJIDO):
            if index < len(fill[sello]):
                artists.append(fill[sello][index])

    artist_slides = [_artist_slide(db, artist, cover) for artist in artists]
    return {"slides": _spread(content, artist_slides), "settings": settings, "content": content_states, "artists": artist_states}


def build_carousel(db: Session, today: date | None = None) -> list[dict]:
    return compose(db, today)["slides"]
