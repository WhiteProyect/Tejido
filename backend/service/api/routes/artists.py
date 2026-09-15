from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.artists import (
    ArtistUpdateInput,
    ConnectionInput,
    MediaInput,
    MetricInput,
    SocialLinkInput,
    TimelineInput,
)
from backend.service.services import artists as svc

router = APIRouter(prefix="/api/artists")


def _check_artist_admin(db: Session, user: Optional[dict], artist_id: int) -> dict:
    if not user or user["role"] not in ("ADMIN", "GESTOR"):
        raise AppError(403, "FORBIDDEN", "Acceso denegado")
    artist = svc.get_artist_by_id(db, artist_id)
    if not artist:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    if user["role"] == "GESTOR" and artist.get("user_id") != user["id"]:
        raise AppError(403, "FORBIDDEN", "No puedes gestionar el perfil de otro artista")
    return artist


# ───────────────────────── rutas literales (deben ir antes de /{slug}) ─────────────────────────

@router.get("")
def list_artists(db: Session = Depends(get_db)):
    return svc.list_artists(db)


@router.get("/home")
def home(db: Session = Depends(get_db)):
    return svc.get_home_artist_data(db) or {}


# ───────────────────────── sub-recursos por slug ─────────────────────────

@router.get("/{slug}/media-kit")
def media_kit(slug: str, db: Session = Depends(get_db)):
    data = svc.get_artist_profile(db, slug)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


@router.get("/{slug}/music")
def music(slug: str, db: Session = Depends(get_db)):
    data = svc.get_artist_discography(db, slug)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


@router.get("/{slug}/timeline")
def timeline(slug: str, db: Session = Depends(get_db)):
    data = svc.get_artist_timeline(db, slug)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


@router.get("/{slug}/media")
def media(slug: str, tipo: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    data = svc.get_artist_media(db, slug, tipo)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


@router.get("/{slug}/social")
def social(slug: str, db: Session = Depends(get_db)):
    data = svc.get_artist_social(db, slug)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


@router.get("/{slug}/connections")
def connections(slug: str, type: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    data = svc.get_artist_connections_data(db, slug, type)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


# ───────────────────────── dashboard (por id numerico) ─────────────────────────

@router.get("/{artist_id:int}/dashboard")
def dashboard(artist_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user or user["role"] not in ("ADMIN", "GESTOR"):
        raise AppError(403, "FORBIDDEN", "Acceso denegado")
    artist = svc.get_artist_by_id(db, artist_id)
    if not artist:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    if user["role"] == "GESTOR" and artist.get("user_id") != user["id"]:
        raise AppError(403, "FORBIDDEN", "No puedes ver el dashboard de otro artista")
    return svc.get_artist_dashboard(db, artist_id)


# ───────────────────────── perfil por slug (catch-all, debe ir al final) ─────────────────────────

@router.get("/{slug}")
def profile(slug: str, db: Session = Depends(get_db)):
    data = svc.get_artist_profile(db, slug)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


# ───────────────────────── mutaciones ─────────────────────────

@router.put("/{artist_id:int}")
def update_artist(artist_id: int, payload: ArtistUpdateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    updates = payload.provided()
    if not updates:
        raise AppError(400, "VALIDATION", "Sin cambios para aplicar")
    svc.update_artist_fields(db, artist_id, updates)
    return {"message": "Artista actualizado"}


@router.post("/{artist_id:int}/timeline", status_code=201)
def create_timeline_entry(artist_id: int, payload: TimelineInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    titulo = (payload.titulo or "").strip()
    if not titulo:
        raise AppError(400, "VALIDATION", "El titulo es requerido")
    entry_id = svc.create_timeline_entry(db, artist_id, {
        "titulo": titulo, "descripcion": payload.descripcion, "fecha": payload.fecha,
        "imagen_url": payload.imagen_url, "video_url": payload.video_url, "orden": payload.orden,
    })
    return {"id": entry_id, "message": "Hito creado"}


@router.put("/{artist_id:int}/timeline/{entry_id:int}")
def update_timeline_entry(artist_id: int, entry_id: int, payload: TimelineInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    rows = svc.update_timeline_entry(db, artist_id, entry_id, updates)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Hito no encontrado o sin cambios")
    return {"message": "Hito actualizado"}


@router.delete("/{artist_id:int}/timeline/{entry_id:int}")
def delete_timeline_entry(artist_id: int, entry_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    rows = svc.delete_timeline_entry(db, artist_id, entry_id)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Hito no encontrado")
    return {"message": "Hito eliminado"}


@router.post("/{artist_id:int}/media", status_code=201)
def create_media_item(artist_id: int, payload: MediaInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    url = (payload.url or "").strip()
    if not url:
        raise AppError(400, "VALIDATION", "La URL es requerida")
    media_id = svc.create_media_item(db, artist_id, {
        "tipo": payload.tipo, "url": url, "titulo": payload.titulo, "descripcion": payload.descripcion,
        "fecha": payload.fecha, "orden": payload.orden, "destacado": payload.destacado,
    })
    return {"id": media_id, "message": "Media agregada"}


@router.put("/{artist_id:int}/media/{media_id:int}")
def update_media_item(artist_id: int, media_id: int, payload: MediaInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    rows = svc.update_media_item(db, artist_id, media_id, updates)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Media no encontrada o sin cambios")
    return {"message": "Media actualizada"}


@router.delete("/{artist_id:int}/media/{media_id:int}")
def delete_media_item(artist_id: int, media_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    rows = svc.delete_media_item(db, artist_id, media_id)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Media no encontrada")
    return {"message": "Media eliminada"}


@router.post("/{artist_id:int}/social", status_code=201)
def create_social_link(artist_id: int, payload: SocialLinkInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    platform = (payload.platform or "").strip()
    url = (payload.url or "").strip()
    if not platform or not url:
        raise AppError(400, "VALIDATION", "Plataforma y URL son requeridas")
    link_id = svc.create_social_link(db, artist_id, {
        "platform": platform, "url": url, "username": payload.username,
        "icon": payload.icon, "orden": payload.orden,
    })
    return {"id": link_id, "message": "Red social agregada"}


@router.delete("/{artist_id:int}/social/{link_id:int}")
def delete_social_link(artist_id: int, link_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    rows = svc.delete_social_link(db, artist_id, link_id)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Red social no encontrada")
    return {"message": "Red social eliminada"}


@router.post("/{artist_id:int}/connections", status_code=201)
def create_connection(artist_id: int, payload: ConnectionInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    entity_type = (payload.entity_type or "").strip()
    titulo = (payload.titulo or "").strip()
    if not entity_type or not titulo:
        raise AppError(400, "VALIDATION", "entity_type y titulo son requeridos")
    conn_id = svc.create_connection(db, artist_id, {
        "entity_type": entity_type, "entity_id": payload.entity_id, "titulo": titulo,
        "descripcion": payload.descripcion, "imagen_url": payload.imagen_url,
        "url": payload.url, "orden": payload.orden,
    })
    return {"id": conn_id, "message": "Conexion creada"}


@router.delete("/{artist_id:int}/connections/{connection_id:int}")
def delete_connection(artist_id: int, connection_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    rows = svc.delete_connection(db, artist_id, connection_id)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Conexion no encontrada")
    return {"message": "Conexion eliminada"}


@router.post("/{artist_id:int}/metrics", status_code=201)
def create_metric(artist_id: int, payload: MetricInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id)
    tipo = (payload.tipo or "").strip()
    if not tipo or payload.valor is None:
        raise AppError(400, "VALIDATION", "tipo y valor son requeridos")
    metric_id = svc.create_metric(db, artist_id, tipo, float(payload.valor), payload.fecha, payload.metadata)
    return {"id": metric_id, "message": "Metrica registrada"}
