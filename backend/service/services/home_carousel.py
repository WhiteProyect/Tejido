"""Carrusel del landing (GET /api/home/carousel): mezcla publicaciones, talento y artistas.

La mezcla y los textos visibles (insignia, etiquetas, boton) se deciden aqui, con las constantes de
abajo. Solo entra lo publico (publicaciones y talento PUBLISHED sin borrar, artistas activos) y cada
diapositiva lleva solo campos publicos: nada de autores, correos, ids de usuario ni moderacion.
"""
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.service.models.tables import CulturalCategoryCover, Publication, TalentProfile
from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES, CULTURAL_CATEGORY_LABELS, category_slug
from backend.service.schemas.municipalities import MUNICIPALITY_LABELS
from backend.service.services import artists as artist_service

MAX_SLIDES = 8
MAX_PUBLICATIONS = 5
MAX_PER_KIND = 2
MAX_TALENT = 2
MAX_EXTRA_ARTISTS = 1
SUMMARY_LIMIT = 180
# Candidatas que se leen para poder respetar el tope por tipo y no repetir rama seguida.
PUBLICATION_CANDIDATES = 40
TALENT_CANDIDATES = 6
# Despues del artista destacado (siempre primero, si hay), el orden de los huecos. Un hueco cuyo
# tipo ya no tiene candidatas (o cuya candidata repetiria la rama anterior) se salta.
PATTERN = ("PUBLICATION", "TALENT", "PUBLICATION", "PUBLICATION", "ARTIST", "TALENT", "PUBLICATION", "PUBLICATION")
# Tipo legado: los perfiles de talento viven en talent_profiles.
EXCLUDED_KINDS = ("TALENTO",)
# Los artistas (Moneystack) no tienen rama: su portada de respaldo es la de Musica.
ARTIST_BRANCH = "MUSICA"

# Los mismos textos de KIND_LABELS en frontend/src/utils/constants.js.
KIND_LABELS = {
    "HISTORIA": "Historia", "EVENTO": "Evento", "OPORTUNIDAD": "Oportunidad",
    "INICIATIVA": "Iniciativa", "LUGAR": "Lugar",
}
TALENT_LABEL = "Talento"
ARTIST_BADGE = "Artista destacado"
# Las etiquetas fijas de la carta del artista de Moneystack.
ARTIST_TAGS = ("Moneystack", "Bajo Cauca", "Música Urbana")
CTA = {"PUBLICATION": "Leer más", "TALENT": "Ver perfil", "ARTIST": "Ver perfil"}
BADGE_SEPARATOR = " · "

ARTIST_FIELDS = ("slug", "stage_name", "bio", "image", "genre", "city", "region",
                 "spotify_url", "youtube_url", "instagram_url", "tiktok_url")
TRACK_FIELDS = ("title", "duration", "spotify_url", "youtube_url")

_TAGS = re.compile(r"<[^>]*>")


def _summary(text) -> str:
    plain = " ".join(_TAGS.sub(" ", str(text or "")).split())
    return plain if len(plain) <= SUMMARY_LIMIT else plain[: SUMMARY_LIMIT - 1].rstrip() + "…"


def _badge_and_tags(parts, extra=()):
    """Insignia "A · B" con las partes que existan y etiquetas que no repiten nada de la insignia."""
    shown = [part for part in parts if part]
    tags = []
    for tag in extra:
        if tag and tag not in shown and tag not in tags:
            tags.append(tag)
    return BADGE_SEPARATOR.join(shown), tags


def _cover_lookup(db: Session):
    covers = dict(db.execute(select(CulturalCategoryCover.category_key, CulturalCategoryCover.image_url)).all())

    def cover(branch):
        if branch not in CULTURAL_CATEGORIES:
            return None
        return covers.get(branch) or f"/images/categorias/{category_slug(branch)}.jpg"
    return cover


def _slide(kind, key, title, summary, image, badge, tags, branch, href, **extra):
    return {"type": kind, "key": key, "title": title, "summary": _summary(summary), "image": image,
            "badge": badge, "tags": tags, "href": href, "cta_label": CTA[kind], "_branch": branch, **extra}


def _publications(db: Session, cover):
    rows = db.execute(
        select(Publication.id, Publication.kind, Publication.title, Publication.summary, Publication.image,
               Publication.cultural_category, Publication.location, Publication.start_date, Publication.end_date)
        .where(Publication.status == "PUBLISHED", Publication.deleted.is_(False),
               Publication.kind.not_in(EXCLUDED_KINDS))
        .order_by(Publication.featured.desc(), Publication.created_at.desc(), Publication.id.desc())
        .limit(PUBLICATION_CANDIDATES)
    ).all()
    picked, per_kind = [], {}
    for row in rows:
        image = row.image or cover(row.cultural_category)
        if not image or per_kind.get(row.kind, 0) >= MAX_PER_KIND:
            continue
        per_kind[row.kind] = per_kind.get(row.kind, 0) + 1
        kind_label = KIND_LABELS.get(row.kind, row.kind.title())
        branch_label = CULTURAL_CATEGORY_LABELS.get(row.cultural_category)
        badge, tags = _badge_and_tags((kind_label, branch_label), (kind_label, branch_label))
        # Rama (pie de la foto) y ficha territorial: solo los datos que existan.
        sheet = {key: value for key, value in (
            ("category_label", branch_label),
            ("location", (row.location or "").strip() or None),
            ("start_date", row.start_date.isoformat() if row.start_date else None),
            ("end_date", row.end_date.isoformat() if row.end_date else None),
        ) if value}
        picked.append(_slide("PUBLICATION", f"publication-{row.id}", row.title, row.summary, image, badge, tags,
                             row.cultural_category, f"#publicacion/{row.id}", **sheet))
        if len(picked) == MAX_PUBLICATIONS:
            break
    return picked


def _talent(db: Session, cover):
    rows = db.execute(
        select(TalentProfile.id, TalentProfile.slug, TalentProfile.name, TalentProfile.tagline,
               TalentProfile.description, TalentProfile.cover_url, TalentProfile.category, TalentProfile.origin)
        .where(TalentProfile.status == "PUBLISHED", TalentProfile.deleted.is_(False))
        .order_by(TalentProfile.featured.desc(), TalentProfile.published_at.desc().nulls_last(), TalentProfile.id.desc())
        .limit(TALENT_CANDIDATES)
    ).all()
    picked = []
    for row in rows:
        image = row.cover_url or cover(row.category)
        if not image:
            continue
        municipality = MUNICIPALITY_LABELS.get(row.origin)
        category_label = CULTURAL_CATEGORY_LABELS.get(row.category)
        badge, tags = _badge_and_tags((TALENT_LABEL, municipality or category_label), (category_label, municipality))
        picked.append(_slide("TALENT", f"talent-{row.id}", row.name, row.tagline or row.description, image, badge, tags,
                             row.category, f"#talento/{row.slug}",
                             **{key: value for key, value in (("municipality", municipality),
                                                              ("category_label", category_label)) if value}))
    return picked


def _artist_slide(db: Session, artist: dict, cover):
    image = artist.get("image") or cover(ARTIST_BRANCH)
    track = artist_service.get_featured_track(db, artist["id"])
    return _slide(
        "ARTIST", f"artist-{artist['id']}", artist["stage_name"], artist.get("bio"), image, ARTIST_BADGE,
        list(ARTIST_TAGS), None, f"#artista/{artist['slug']}" if artist.get("slug") else "#moneystack",
        artist={field: artist.get(field) for field in ARTIST_FIELDS},
        featured_track={field: track.get(field) for field in TRACK_FIELDS} if track else None,
    )


def build_carousel(db: Session) -> list[dict]:
    cover = _cover_lookup(db)
    # Mismo orden que /api/artists/home (services/artists.get_home_artist_data): el primero es el destacado.
    artists = artist_service.list_artists(db)
    slides = [_artist_slide(db, artists[0], cover)] if artists else []
    pools = {
        "PUBLICATION": _publications(db, cover),
        "TALENT": _talent(db, cover)[:MAX_TALENT],
        "ARTIST": [_artist_slide(db, artist, cover) for artist in artists[1:1 + MAX_EXTRA_ARTISTS]],
    }
    for slot in PATTERN:
        if len(slides) >= MAX_SLIDES:
            break
        previous = slides[-1]["_branch"] if slides else None
        pool = pools[slot]
        index = next((i for i, item in enumerate(pool) if not (item["_branch"] and item["_branch"] == previous)), None)
        if index is not None:
            slides.append(pool.pop(index))
    for slide in slides:
        del slide["_branch"]
    return slides
