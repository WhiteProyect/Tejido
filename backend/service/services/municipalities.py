"""Municipio de publicaciones y artistas: validacion comun y la pagina publica de cada municipio
(GET /api/municipalities/{slug}).

La validacion de la API general responde 400; el municipio obligatorio responde 422 con su propio
codigo (como TERMS_REQUIRED en el registro), asi el formulario lo muestra en su campo.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import Artist, Publication, TalentProfile
from backend.service.schemas.municipalities import municipality_slug
from backend.service.services import talent as talent_service

PUBLICATION_MESSAGE = "Elige el municipio de la publicación"
ARTIST_MESSAGE = "Elige el municipio del artista"
PAGE_PUBLICATIONS = 12
PAGE_TALENT = 6


def require_municipality(value, message: str) -> str:
    slug = municipality_slug(value)
    if slug is None:
        raise AppError(422, "MUNICIPALITY_REQUIRED", message)
    return slug


def municipality_filter(value) -> str | None:
    """?municipality=<slug> de los listados: None si no viene; 422 si viene y no es uno de los 6."""
    if value is None or not str(value).strip():
        return None
    slug = municipality_slug(value)
    if slug is None:
        raise AppError(422, "INVALID_MUNICIPALITY", "Municipio no válido")
    return slug


def municipality_page(db: Session, slug: str) -> dict:
    """Solo lo publico del municipio: publicaciones PUBLISHED sin borrar, talento PUBLISHED y artistas
    activos. Campos de tarjeta, sin autores, correos ni moderacion."""
    published = (Publication.municipality == slug, Publication.status == "PUBLISHED", Publication.deleted.is_(False))
    talent_visible = (TalentProfile.origin == slug, TalentProfile.status == "PUBLISHED", TalentProfile.deleted.is_(False))
    active = (Artist.municipality == slug, Artist.active.is_(True))

    counts = db.execute(select(
        select(func.count()).select_from(Publication).where(*published).scalar_subquery().label("publications"),
        select(func.count()).select_from(TalentProfile).where(*talent_visible).scalar_subquery().label("talent"),
        select(func.count()).select_from(Artist).where(*active).scalar_subquery().label("artists"),
    )).one()
    publications = db.execute(
        select(Publication.id, Publication.title, Publication.summary, Publication.image, Publication.kind,
               Publication.cultural_category, Publication.location, Publication.start_date, Publication.municipality)
        .where(*published)
        .order_by(Publication.created_at.desc(), Publication.id.desc())
        .limit(PAGE_PUBLICATIONS)
    ).mappings().all()
    profiles = db.execute(
        select(TalentProfile).where(*talent_visible)
        .order_by(TalentProfile.featured.desc(), TalentProfile.published_at.desc().nulls_last(), TalentProfile.id.desc())
        .limit(PAGE_TALENT)
    ).scalars().all()
    artists = db.execute(
        select(Artist.slug, Artist.stage_name, Artist.image, Artist.genre, Artist.moneystack, Artist.municipality)
        .where(*active)
        .order_by(Artist.featured.desc(), Artist.stage_name)
    ).mappings().all()
    return {
        "slug": slug,
        "counts": {"publications": counts.publications, "talent": counts.talent, "artists": counts.artists},
        "publications": [dict(row) for row in publications],
        # Las mismas tarjetas del listado publico de talento (sin sesion: favorite siempre false).
        "talent": talent_service.public_cards(db, profiles),
        "artists": [dict(row) for row in artists],
    }
