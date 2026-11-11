"""Carrusel del landing (GET /api/home/carousel): contenido por categoria intercalado con Moneystack.

Contenido: UNA publicacion por categoria cultural (la destacada o, si no hay, la mas reciente) y UN
talento, solo lo publico y vigente; ordenado por (destacado, recencia). Despues de cada diapositiva
de contenido van artistas de Moneystack: [contenido, artista, contenido, artista, ...]. Los artistas
destacados (hasta MAX_FEATURED_ARTISTS) salen siempre; los demas rellenan los huecos que queden, en el
orden de list_artists y en ciclo, sin repetir el mismo dos veces seguidas. Si hay mas destacados que
contenido, los que sobran se reparten parejo y quedan artistas seguidos. Sin artistas, solo
contenido; sin contenido, solo artistas (destacados primero).
Cada diapositiva lleva solo campos publicos (nada de autores, correos, ids de usuario ni moderacion)
y solo los datos que existan: lo que la publicacion no tiene no viaja.
"""
import re
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.service.models.tables import CulturalCategoryCover, Publication, TalentProfile
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS, category_slug
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services import artists as artist_service

# Diez categorias + un talento.
MAX_CONTENT = len(CULTURAL_CATEGORIES) + 1
SUMMARY_LIMIT = 240
# Del contenido (cuando falta el resumen) solo se leen estos caracteres de la base.
EXCERPT_SOURCE = 600
PUBLICATION_TAGS_SHOWN = 2
# Tipo legado: los perfiles de talento viven en talent_profiles.
EXCLUDED_KINDS = ("TALENTO",)
# Destacados que salen siempre, haya poco o mucho contenido. Los que pasen del tope entran como
# cualquier otro artista: solo en los huecos que queden.
MAX_FEATURED_ARTISTS = 6
# Los artistas (Moneystack) no tienen rama: su portada de respaldo es la de Musica.
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

# La carta del artista de Moneystack (sin cambios).
ARTIST_BADGE = "Artista destacado"
ARTIST_TAGS = ("Moneystack", "Bajo Cauca", "Música Urbana")
ARTIST_CTA = "Ver perfil"
ARTIST_SUMMARY_LIMIT = 180
ARTIST_FIELDS = ("slug", "stage_name", "bio", "image", "genre", "city", "region",
                 "spotify_url", "youtube_url", "instagram_url", "tiktok_url")
TRACK_FIELDS = ("title", "duration", "spotify_url", "youtube_url")

_TAGS = re.compile(r"<[^>]*>")


def _plain(text) -> str:
    return " ".join(_TAGS.sub(" ", str(text or "")).split())


def _summary(text, limit=SUMMARY_LIMIT) -> str:
    plain = _plain(text)
    return plain if len(plain) <= limit else plain[: limit - 1].rstrip() + "…"


def today_bogota() -> date:
    return datetime.now(BOGOTA).date()


def _cover_lookup(db: Session):
    covers = dict(db.execute(select(CulturalCategoryCover.category_key, CulturalCategoryCover.image_url)).all())

    def cover(branch):
        if branch not in CULTURAL_CATEGORIES:
            return None
        return covers.get(branch) or f"/images/categorias/{category_slug(branch)}.jpg"
    return cover


def _present(**fields):
    """Solo los campos con dato (sin None, cadenas vacias ni listas vacias)."""
    return {key: value for key, value in fields.items() if value not in (None, "", [], ())}


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
    # Para ordenar el contenido; no viaja.
    slide["_order"] = (bool(featured), recency)
    return slide


def _publications(db: Session, cover, today: date):
    start_of_today = datetime.combine(today, time.min)
    rows = db.execute(
        # Postgres: DISTINCT ON se queda con la primera fila de cada categoria segun el ORDER BY.
        select(Publication.id, Publication.kind, Publication.title, Publication.summary,
               func.substr(Publication.content, 1, EXCERPT_SOURCE).label("excerpt"), Publication.image,
               Publication.cultural_category, Publication.municipality, Publication.location,
               Publication.start_date, Publication.end_date, Publication.tagline, Publication.tags,
               Publication.featured, Publication.created_at)
        .where(
            Publication.status == "PUBLISHED", Publication.deleted.is_(False),
            Publication.kind.not_in(EXCLUDED_KINDS),
            Publication.cultural_category.in_(CULTURAL_CATEGORIES),
            # Vigencia (dia de Bogota): un evento sale cuando pasa su ultimo dia (end_date o, si no hay,
            # start_date); una oportunidad, cuando pasa su cierre. Sin fecha, entra.
            or_(Publication.kind != "EVENTO",
                func.coalesce(Publication.end_date, Publication.start_date).is_(None),
                func.coalesce(Publication.end_date, Publication.start_date) >= start_of_today),
            or_(Publication.kind != "OPORTUNIDAD", Publication.end_date.is_(None),
                Publication.end_date >= start_of_today),
        )
        .distinct(Publication.cultural_category)
        .order_by(Publication.cultural_category, Publication.featured.desc(), Publication.created_at.desc(),
                  Publication.id.desc())
    ).all()
    slides = []
    for row in rows:
        slides.append(_content_slide(
            "PUBLICATION", row.kind, f"publication-{row.id}", row.title, row.summary or row.excerpt,
            row.image or cover(row.cultural_category), MUNICIPALITY_LABELS.get(row.municipality),
            CULTURAL_CATEGORY_LABELS.get(row.cultural_category), f"#publicacion/{row.id}",
            row.created_at, row.featured, tags=row.tags or (),
            tagline=(row.tagline or "").strip() or None,
            location=(row.location or "").strip() or None,
            start_date=row.start_date.isoformat() if row.start_date else None,
            end_date=row.end_date.isoformat() if row.end_date else None,
        ))
    return slides


def _talent(db: Session, cover):
    rows = db.execute(
        select(TalentProfile.id, TalentProfile.slug, TalentProfile.name, TalentProfile.tagline,
               TalentProfile.description, TalentProfile.cover_url, TalentProfile.category, TalentProfile.origin,
               TalentProfile.featured, TalentProfile.published_at, TalentProfile.created_at)
        .where(TalentProfile.status == "PUBLISHED", TalentProfile.deleted.is_(False))
        .order_by(TalentProfile.featured.desc(), TalentProfile.published_at.desc().nulls_last(), TalentProfile.id.desc())
        .limit(6)
    ).all()
    for row in rows:
        image = row.cover_url or cover(row.category)
        if not image:
            continue
        tagline = (row.tagline or "").strip() or None
        return [_content_slide(
            "TALENT", "TALENT", f"talent-{row.id}", row.name, row.description or tagline, image,
            MUNICIPALITY_LABELS.get(row.origin), CULTURAL_CATEGORY_LABELS.get(row.category), f"#talento/{row.slug}",
            row.published_at or row.created_at, row.featured, tagline=tagline,
        )]
    return []


def _artist_slide(db: Session, artist: dict, cover):
    image = artist.get("image") or cover(ARTIST_BRANCH)
    track = artist_service.get_featured_track(db, artist["id"])
    return {
        "type": "ARTIST", "key": f"artist-{artist['id']}", "title": artist["stage_name"],
        "summary": _summary(artist.get("bio"), ARTIST_SUMMARY_LIMIT), "image": image, "badge": ARTIST_BADGE, "tags": list(ARTIST_TAGS),
        "href": f"#artista/{artist['slug']}" if artist.get("slug") else "#moneystack", "cta_label": ARTIST_CTA,
        "artist": {field: artist.get(field) for field in ARTIST_FIELDS},
        "featured_track": {field: track.get(field) for field in TRACK_FIELDS} if track else None,
    }


def _artist_cycle(artists: list[dict], count: int) -> list[dict]:
    """`count` artistas en el orden dado, en ciclo. Con dos o mas, nunca el mismo dos veces seguidas,
    tampoco al dar la vuelta (el ultimo y el primero tambien quedan seguidos en el carrusel) salvo con
    exactamente dos artistas y un numero impar de huecos, donde es inevitable."""
    picked = [artists[i % len(artists)] for i in range(count)]
    if len(artists) > 1 and count > 2 and picked[-1] is picked[0]:
        other = next((a for a in artists if a is not picked[0] and a is not picked[-2]), None)
        if other is not None:
            picked[-1] = other
    return picked


def _artist_gaps(featured: list[dict], others: list[dict], gaps: int) -> list[list[dict]]:
    """Los artistas que van despues de cada diapositiva de contenido. Si los destacados caben, uno
    por hueco en el orden de list_artists (destacados primero) y en ciclo; si no, solo los destacados,
    repartidos parejo (los primeros huecos llevan uno de mas)."""
    if len(featured) <= gaps:
        return [[artist] for artist in _artist_cycle(featured + others, gaps)]
    size, extra = divmod(len(featured), gaps)
    blocks, start = [], 0
    for gap in range(gaps):
        end = start + size + (gap < extra)
        blocks.append(featured[start:end])
        start = end
    return blocks


def build_carousel(db: Session, today: date | None = None) -> list[dict]:
    today = today or today_bogota()
    cover = _cover_lookup(db)
    content = _publications(db, cover, today) + _talent(db, cover)
    content.sort(key=lambda slide: slide["_order"], reverse=True)
    content = content[:MAX_CONTENT]
    for slide in content:
        del slide["_order"]
    # Solo el sello Moneystack (los de TEJIDO no entran a sus diapositivas), en el mismo orden que
    # /api/artists/home (services/artists.get_home_artist_data): destacados primero.
    artists = artist_service.list_artists(db, sello="moneystack")
    featured = [artist for artist in artists if artist["featured"]][:MAX_FEATURED_ARTISTS]
    others = [artist for artist in artists if artist not in featured]
    if not content:
        return [_artist_slide(db, artist, cover) for artist in featured + others]
    if not artists:
        return content
    artist_slides = {artist["id"]: _artist_slide(db, artist, cover) for artist in artists}
    slides = []
    for slide, block in zip(content, _artist_gaps(featured, others, len(content))):
        slides += [slide] + [artist_slides[artist["id"]] for artist in block]
    return slides
