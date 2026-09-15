from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.service.models.tables import (
    Artist,
    ArtistConnection,
    ArtistMedia,
    ArtistMetric,
    ArtistSocialLink,
    ArtistTimeline,
    Event,
    Publication,
    Track,
)
from backend.service.services.serialization import model_to_dict, models_to_dicts, row_to_dict, rows_to_dicts


def now_utc():
    return datetime.now(timezone.utc)


# ───────────────────────── lecturas base ─────────────────────────

def list_artists(db: Session):
    artists = db.execute(
        select(Artist).where(Artist.active.is_(True)).order_by(Artist.featured.desc(), Artist.name)
    ).scalars().all()
    return models_to_dicts(artists)


def get_artist_by_id(db: Session, artist_id: int):
    artist = db.execute(select(Artist).where(Artist.id == artist_id, Artist.active.is_(True))).scalar_one_or_none()
    return model_to_dict(artist)


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


def get_tracks_by_artist(db: Session, artist_id: int):
    tracks = db.execute(
        select(Track).where(Track.artist_id == artist_id).order_by(Track.featured.desc(), Track.release_date.desc())
    ).scalars().all()
    return models_to_dicts(tracks)


def get_featured_track(db: Session, artist_id: int):
    track = db.execute(
        select(Track).where(Track.artist_id == artist_id, Track.featured.is_(True)).limit(1)
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


# ───────────────────────── mutaciones ─────────────────────────

def update_artist_fields(db: Session, artist_id: int, data: dict):
    allowed = (
        "name", "stage_name", "slug", "real_name", "bio", "image", "hero_image", "genre",
        "city", "region", "spotify_url", "youtube_url", "instagram_url", "tiktok_url", "featured",
    )
    updates = {key: data[key] for key in allowed if key in data}
    if not updates:
        return False
    updates["updated_at"] = now_utc()
    db.query(Artist).filter(Artist.id == artist_id).update(updates)
    return True


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


def delete_connection(db: Session, artist_id: int, connection_id: int) -> int:
    return db.query(ArtistConnection).filter(
        ArtistConnection.artist_id == artist_id, ArtistConnection.id == connection_id
    ).delete()


def create_metric(db: Session, artist_id: int, tipo: str, valor: float, fecha: str, metadata=None) -> int:
    metric = ArtistMetric(artist_id=artist_id, tipo=tipo, valor=valor, fecha=fecha, metadata_=metadata)
    db.add(metric)
    db.flush()
    return metric.id
