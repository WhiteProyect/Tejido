import re
import unicodedata
from datetime import datetime, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.service.errors import AppError
from backend.service.models.tables import (
    Artist,
    ArtistConnection,
    ArtistMedia,
    ArtistMetric,
    ArtistSocialLink,
    ArtistTimeline,
    Event,
    Publication,
    Role,
    Track,
    User,
)
from backend.service.schemas.artists import MAX_SLUG_LENGTH, RESERVED_SLUGS
from backend.service.services.serialization import model_to_dict, models_to_dicts, row_to_dict, rows_to_dicts


def now_utc():
    return datetime.now(timezone.utc)


# ───────────────────────── lecturas base ─────────────────────────

def list_artists(db: Session):
    artists = db.execute(
        select(Artist).where(Artist.active.is_(True)).order_by(Artist.featured.desc(), Artist.name)
    ).scalars().all()
    return models_to_dicts(artists)


def get_artist_by_id(db: Session, artist_id: int, include_inactive: bool = False):
    stmt = select(Artist).where(Artist.id == artist_id)
    if not include_inactive:
        stmt = stmt.where(Artist.active.is_(True))
    return model_to_dict(db.execute(stmt).scalar_one_or_none())


def get_artist_by_slug(db: Session, slug: str):
    artist = db.execute(
        select(Artist).where(func.lower(Artist.slug) == func.lower(slug), Artist.active.is_(True))
    ).scalar_one_or_none()
    return model_to_dict(artist)


def get_artist_by_stage_name(db: Session, stage_name: str):
    artist = db.execute(
        select(Artist).where(
            func.lower(func.replace(Artist.stage_name, " ", "-")) == func.lower(stage_name),
            Artist.active.is_(True),
        )
    ).scalar_one_or_none()
    if artist:
        return model_to_dict(artist)
    return get_artist_by_slug(db, stage_name)


def _resolve_artist(db: Session, slug: str):
    artist = get_artist_by_slug(db, slug)
    if not artist:
        artist = get_artist_by_stage_name(db, slug)
    return artist


# Las lecturas publicas solo ven canciones publicadas; los borradores no salen en el perfil.
def get_tracks_by_artist(db: Session, artist_id: int):
    tracks = db.execute(
        select(Track)
        .where(Track.artist_id == artist_id, Track.status == "published")
        .order_by(Track.featured.desc(), Track.release_date.desc())
    ).scalars().all()
    return models_to_dicts(tracks)


def get_featured_track(db: Session, artist_id: int):
    track = db.execute(
        select(Track)
        .where(Track.artist_id == artist_id, Track.featured.is_(True), Track.status == "published")
        .limit(1)
    ).scalar_one_or_none()
    return model_to_dict(track)


def get_timeline_by_artist(db: Session, artist_id: int):
    rows = db.execute(
        select(ArtistTimeline)
        .where(ArtistTimeline.artist_id == artist_id)
        .order_by(ArtistTimeline.orden.asc(), ArtistTimeline.fecha.asc())
    ).scalars().all()
    return models_to_dicts(rows)


def get_media_by_artist(db: Session, artist_id: int, tipo: str | None = None):
    stmt = select(ArtistMedia).where(ArtistMedia.artist_id == artist_id)
    if tipo:
        stmt = stmt.where(ArtistMedia.tipo == tipo)
    rows = db.execute(stmt.order_by(ArtistMedia.orden.asc())).scalars().all()
    return models_to_dicts(rows)


def get_social_links_by_artist(db: Session, artist_id: int):
    rows = db.execute(
        select(ArtistSocialLink).where(ArtistSocialLink.artist_id == artist_id).order_by(ArtistSocialLink.orden.asc())
    ).scalars().all()
    return models_to_dicts(rows)


def get_connections_by_artist(db: Session, artist_id: int, entity_type: str | None = None):
    stmt = select(ArtistConnection).where(ArtistConnection.artist_id == artist_id)
    if entity_type:
        stmt = stmt.where(ArtistConnection.entity_type == entity_type)
    rows = db.execute(stmt.order_by(ArtistConnection.orden.asc())).scalars().all()
    return models_to_dicts(rows)


def get_metrics_by_artist(db: Session, artist_id: int):
    rows = db.execute(
        select(ArtistMetric).where(ArtistMetric.artist_id == artist_id).order_by(ArtistMetric.fecha.desc())
    ).scalars().all()
    return models_to_dicts(rows)


# ───────────────────────── vistas compuestas (services/artist_service.py) ─────────────────────────

def get_artist_profile(db: Session, slug: str):
    artist = _resolve_artist(db, slug)
    if not artist:
        return None
    artist_id = artist["id"]

    upcoming = db.execute(
        select(
            Publication.id, Publication.title, Publication.summary, Publication.image,
            Publication.location, Publication.start_date, Event.venue, Event.capacity,
        )
        .join(Event, Event.publication_id == Publication.id, isouter=True)
        .where(
            Publication.kind == "EVENTO",
            Publication.status == "PUBLISHED",
            Publication.deleted.is_(False),
            or_(Publication.title.ilike(f"%{artist['stage_name']}%"), Publication.content.ilike(f"%{artist['stage_name']}%")),
        )
        .order_by(Publication.start_date.asc())
        .limit(5)
    ).all()

    return {
        "artist": artist,
        "tracks": get_tracks_by_artist(db, artist_id),
        "featured_track": get_featured_track(db, artist_id),
        "timeline": get_timeline_by_artist(db, artist_id),
        "media": get_media_by_artist(db, artist_id),
        "social_links": get_social_links_by_artist(db, artist_id),
        "connections": get_connections_by_artist(db, artist_id),
        "upcoming_events": rows_to_dicts(upcoming),
    }


def get_artist_discography(db: Session, slug: str):
    artist = _resolve_artist(db, slug)
    if not artist:
        return None
    return {
        "artist": {"id": artist["id"], "stage_name": artist["stage_name"]},
        "tracks": get_tracks_by_artist(db, artist["id"]),
    }


def get_artist_timeline(db: Session, slug: str):
    artist = _resolve_artist(db, slug)
    if not artist:
        return None
    return {
        "artist": {"id": artist["id"], "stage_name": artist["stage_name"]},
        "timeline": get_timeline_by_artist(db, artist["id"]),
    }


def get_artist_media(db: Session, slug: str, tipo: str | None = None):
    artist = _resolve_artist(db, slug)
    if not artist:
        return None
    return {
        "artist": {"id": artist["id"], "stage_name": artist["stage_name"]},
        "media": get_media_by_artist(db, artist["id"], tipo),
    }


def get_artist_social(db: Session, slug: str):
    artist = _resolve_artist(db, slug)
    if not artist:
        return None
    return {
        "artist": {"id": artist["id"], "stage_name": artist["stage_name"]},
        "social_links": get_social_links_by_artist(db, artist["id"]),
    }


def get_artist_connections_data(db: Session, slug: str, entity_type: str | None = None):
    artist = _resolve_artist(db, slug)
    if not artist:
        return None
    return {
        "artist": {"id": artist["id"], "stage_name": artist["stage_name"]},
        "connections": get_connections_by_artist(db, artist["id"], entity_type),
    }


def get_artist_dashboard(db: Session, artist_id: int):
    metrics = get_metrics_by_artist(db, artist_id)
    latest = {}
    for m in metrics:
        if m["tipo"] not in latest:
            latest[m["tipo"]] = m
    return {"metrics": metrics, "latest": latest}


def get_home_artist_data(db: Session):
    artists = list_artists(db)
    if not artists:
        return None
    artist = artists[0]
    return {"artist": artist, "featured_track": get_featured_track(db, artist["id"])}


def list_artists_admin(db: Session):
    """Todos los artistas (tambien archivados) con conteos por seccion; activos primero."""
    artists = db.execute(
        select(Artist.id, Artist.slug, Artist.stage_name, Artist.genre, Artist.image, Artist.featured, Artist.active)
        .order_by(Artist.active.desc(), Artist.featured.desc(), Artist.stage_name)
    ).all()
    sections = {
        "tracks": Track, "media": ArtistMedia, "timeline": ArtistTimeline,
        "social": ArtistSocialLink, "connections": ArtistConnection, "metrics": ArtistMetric,
    }
    counts = {
        key: dict(db.execute(select(model.artist_id, func.count()).group_by(model.artist_id)).all())
        for key, model in sections.items()
    }
    result = rows_to_dicts(artists)
    for artist in result:
        artist["counts"] = {key: counts[key].get(artist["id"], 0) for key in sections}
    return result


def get_artist_admin_detail(db: Session, artist_id: int):
    """Todo lo de un artista para el panel de admin: tambien archivado y con borradores
    (las lecturas publicas ocultan ambos). Mismas claves que el perfil publico, mas metrics."""
    artist = get_artist_by_id(db, artist_id, include_inactive=True)
    if not artist:
        return None
    tracks = db.execute(
        select(Track).where(Track.artist_id == artist_id).order_by(Track.featured.desc(), Track.release_date.desc())
    ).scalars().all()
    return {
        "artist": artist,
        "tracks": models_to_dicts(tracks),
        "timeline": get_timeline_by_artist(db, artist_id),
        "media": get_media_by_artist(db, artist_id),
        "social_links": get_social_links_by_artist(db, artist_id),
        "connections": get_connections_by_artist(db, artist_id),
        "metrics": get_metrics_by_artist(db, artist_id),
    }


# ───────────────────────── slugs ─────────────────────────

def slugify(text: str) -> str:
    """'DJ Apolo' -> 'dj-apolo': minusculas, sin tildes, guiones."""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:MAX_SLUG_LENGTH].strip("-")


def artist_slug_taken(db: Session, slug: str, exclude_id: int | None = None) -> bool:
    """Unicidad sin distinguir mayusculas entre TODOS los artistas (activos y archivados)."""
    stmt = select(Artist.id).where(func.lower(Artist.slug) == slug.lower())
    if exclude_id is not None:
        stmt = stmt.where(Artist.id != exclude_id)
    return db.execute(stmt.limit(1)).first() is not None


def _with_suffix(base: str, taken) -> str:
    candidate, n = base, 2
    while taken(candidate):
        suffix = f"-{n}"
        candidate = base[:MAX_SLUG_LENGTH - len(suffix)].strip("-") + suffix
        n += 1
    return candidate


def generate_artist_slug(db: Session, stage_name: str) -> str:
    base = slugify(stage_name) or "artista"
    if base.isdigit():
        base = f"artista-{base}"
    return _with_suffix(base, lambda c: c in RESERVED_SLUGS or artist_slug_taken(db, c))


# ───────────────────────── mutaciones ─────────────────────────

def _flush_unique_slug(db: Session):
    # El indice unico lower(slug) es la ultima red ante dos altas simultaneas con el mismo slug.
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "SLUG_IN_USE", "Ya existe un artista con ese slug")


def is_gestor(db: Session, user_id: int) -> bool:
    return db.execute(
        select(User.id).join(Role, Role.id == User.role_id).where(User.id == user_id, Role.name == "GESTOR")
    ).first() is not None


def create_artist(db: Session, data: dict) -> Artist:
    ts = now_utc()
    artist = Artist(**data, created_at=ts, updated_at=ts)
    db.add(artist)
    _flush_unique_slug(db)
    return artist


def set_artist_active(db: Session, artist_id: int, active: bool) -> bool:
    """False si ya estaba en ese estado (archivar y restaurar son idempotentes)."""
    artist = db.get(Artist, artist_id)
    if artist.active == active:
        return False
    artist.active = active
    artist.updated_at = now_utc()
    db.flush()
    return True


def update_artist_fields(db: Session, artist_id: int, data: dict):
    allowed = (
        "name", "stage_name", "slug", "real_name", "bio", "image", "hero_image", "genre",
        "city", "region", "spotify_url", "youtube_url", "instagram_url", "tiktok_url", "featured",
        "active", "user_id",
    )
    updates = {key: data[key] for key in allowed if key in data}
    if not updates:
        return False
    updates["updated_at"] = now_utc()
    try:
        db.query(Artist).filter(Artist.id == artist_id).update(updates)
    except IntegrityError:
        db.rollback()
        raise AppError(409, "SLUG_IN_USE", "Ya existe un artista con ese slug")
    return True


def track_slug_taken(db: Session, artist_id: int, slug: str, exclude_id: int | None = None) -> bool:
    stmt = select(Track.id).where(Track.artist_id == artist_id, func.lower(Track.slug) == slug.lower())
    if exclude_id is not None:
        stmt = stmt.where(Track.id != exclude_id)
    return db.execute(stmt.limit(1)).first() is not None


def _unfeature_other_tracks(db: Session, artist_id: int, keep_id: int):
    # El perfil muestra UNA cancion destacada (featured_track): marcar una desmarca las demas.
    db.execute(
        update(Track)
        .where(Track.artist_id == artist_id, Track.id != keep_id, Track.featured.is_(True))
        .values(featured=False)
    )


def create_track(db: Session, artist_id: int, data: dict) -> Track:
    slug = data.pop("slug", None)
    if slug is None:
        base = slugify(data["title"]) or "cancion"
        slug = _with_suffix(base, lambda c: track_slug_taken(db, artist_id, c))
    elif track_slug_taken(db, artist_id, slug):
        raise AppError(409, "SLUG_IN_USE", "Este artista ya tiene una canción con ese slug")
    data.setdefault("status", "published")
    data.setdefault("featured", False)
    track = Track(artist_id=artist_id, slug=slug, **data, created_at=now_utc())
    db.add(track)
    db.flush()
    if track.featured:
        _unfeature_other_tracks(db, artist_id, track.id)
    return track


def get_track(db: Session, artist_id: int, track_id: int):
    return db.execute(select(Track).where(Track.artist_id == artist_id, Track.id == track_id)).scalar_one_or_none()


def update_track(db: Session, track: Track, data: dict):
    # slug vacio en un PUT = conservar el actual (no se puede dejar una cancion sin slug).
    if data.get("slug") is None:
        data.pop("slug", None)
    elif track_slug_taken(db, track.artist_id, data["slug"], exclude_id=track.id):
        raise AppError(409, "SLUG_IN_USE", "Este artista ya tiene una canción con ese slug")
    for key, value in data.items():
        setattr(track, key, value)
    db.flush()
    if data.get("featured"):
        _unfeature_other_tracks(db, track.artist_id, track.id)


def delete_track(db: Session, artist_id: int, track_id: int) -> int:
    return db.query(Track).filter(Track.artist_id == artist_id, Track.id == track_id).delete()


def create_timeline_entry(db: Session, artist_id: int, data: dict) -> int:
    entry = ArtistTimeline(
        artist_id=artist_id,
        titulo=data["titulo"],
        descripcion=data.get("descripcion"),
        fecha=data.get("fecha"),
        imagen_url=data.get("imagen_url"),
        video_url=data.get("video_url"),
        orden=data.get("orden", 0),
    )
    db.add(entry)
    db.flush()
    return entry.id


def update_timeline_entry(db: Session, artist_id: int, entry_id: int, data: dict) -> int:
    allowed = ("titulo", "descripcion", "fecha", "imagen_url", "video_url", "orden")
    updates = {key: data[key] for key in allowed if key in data}
    if not updates:
        return 0
    result = db.query(ArtistTimeline).filter(
        ArtistTimeline.artist_id == artist_id, ArtistTimeline.id == entry_id
    ).update(updates)
    return result


def delete_timeline_entry(db: Session, artist_id: int, entry_id: int) -> int:
    return db.query(ArtistTimeline).filter(
        ArtistTimeline.artist_id == artist_id, ArtistTimeline.id == entry_id
    ).delete()


def create_media_item(db: Session, artist_id: int, data: dict) -> int:
    item = ArtistMedia(
        artist_id=artist_id,
        tipo=data.get("tipo", "image"),
        url=data["url"],
        titulo=data.get("titulo"),
        descripcion=data.get("descripcion"),
        fecha=data.get("fecha"),
        orden=data.get("orden", 0),
        destacado=bool(data.get("destacado", False)),
    )
    db.add(item)
    db.flush()
    return item.id


def get_media_item(db: Session, artist_id: int, media_id: int):
    return db.execute(
        select(ArtistMedia).where(ArtistMedia.artist_id == artist_id, ArtistMedia.id == media_id)
    ).scalar_one_or_none()


def update_media_item(db: Session, artist_id: int, media_id: int, data: dict) -> int:
    allowed = ("tipo", "url", "titulo", "descripcion", "fecha", "orden", "destacado")
    updates = {key: data[key] for key in allowed if key in data}
    if not updates:
        return 0
    return db.query(ArtistMedia).filter(
        ArtistMedia.artist_id == artist_id, ArtistMedia.id == media_id
    ).update(updates)


def delete_media_item(db: Session, artist_id: int, media_id: int) -> int:
    return db.query(ArtistMedia).filter(
        ArtistMedia.artist_id == artist_id, ArtistMedia.id == media_id
    ).delete()


def create_social_link(db: Session, artist_id: int, data: dict) -> int:
    link = ArtistSocialLink(
        artist_id=artist_id,
        platform=data["platform"],
        url=data["url"],
        username=data.get("username"),
        icon=data.get("icon"),
        orden=data.get("orden", 0),
    )
    db.add(link)
    db.flush()
    return link.id


def update_social_link(db: Session, artist_id: int, link_id: int, data: dict) -> int:
    allowed = ("platform", "url", "username", "icon", "orden")
    updates = {key: data[key] for key in allowed if key in data}
    if not updates:
        return 0
    return db.query(ArtistSocialLink).filter(
        ArtistSocialLink.artist_id == artist_id, ArtistSocialLink.id == link_id
    ).update(updates)


def delete_social_link(db: Session, artist_id: int, link_id: int) -> int:
    return db.query(ArtistSocialLink).filter(
        ArtistSocialLink.artist_id == artist_id, ArtistSocialLink.id == link_id
    ).delete()


def create_connection(db: Session, artist_id: int, data: dict) -> int:
    connection = ArtistConnection(
        artist_id=artist_id,
        entity_type=data["entity_type"],
        entity_id=data.get("entity_id"),
        titulo=data["titulo"],
        descripcion=data.get("descripcion"),
        imagen_url=data.get("imagen_url"),
        url=data.get("url"),
        orden=data.get("orden", 0),
    )
    db.add(connection)
    db.flush()
    return connection.id


def update_connection(db: Session, artist_id: int, connection_id: int, data: dict) -> int:
    allowed = ("entity_type", "entity_id", "titulo", "descripcion", "imagen_url", "url", "orden")
    updates = {key: data[key] for key in allowed if key in data}
    if not updates:
        return 0
    return db.query(ArtistConnection).filter(
        ArtistConnection.artist_id == artist_id, ArtistConnection.id == connection_id
    ).update(updates)


def delete_connection(db: Session, artist_id: int, connection_id: int) -> int:
    return db.query(ArtistConnection).filter(
        ArtistConnection.artist_id == artist_id, ArtistConnection.id == connection_id
    ).delete()


def create_metric(db: Session, artist_id: int, tipo: str, valor: float, fecha: str, metadata=None) -> int:
    metric = ArtistMetric(artist_id=artist_id, tipo=tipo, valor=valor, fecha=fecha, metadata_=metadata)
    db.add(metric)
    db.flush()
    return metric.id


def update_metric(db: Session, artist_id: int, metric_id: int, data: dict) -> int:
    updates = {("metadata_" if key == "metadata" else key): value for key, value in data.items()
               if key in ("tipo", "valor", "fecha", "metadata")}
    if not updates:
        return 0
    return db.query(ArtistMetric).filter(
        ArtistMetric.artist_id == artist_id, ArtistMetric.id == metric_id
    ).update(updates)


def delete_metric(db: Session, artist_id: int, metric_id: int) -> int:
    return db.query(ArtistMetric).filter(ArtistMetric.artist_id == artist_id, ArtistMetric.id == metric_id).delete()
