from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.service.api.deps import get_current_user, require_roles
from backend.service.db.session import get_db
from backend.service.errors import AppError
from backend.service.schemas.artists import (
    ArtistCreateInput,
    ArtistUpdateInput,
    ConnectionInput,
    MediaInput,
    MetricInput,
    MetricUpdateInput,
    SocialLinkInput,
    TimelineInput,
    TrackInput,
)
from backend.service.services import artists as svc

router = APIRouter(prefix="/api/artists")

ADMIN_ONLY = "Solo un administrador puede hacer esto"
# Campos del PUT que el GESTOR dueno no puede tocar: definen la identidad publica y la propiedad.
ADMIN_ONLY_FIELDS = {"slug", "featured", "active", "user_id"}


def _check_artist_admin(db: Session, user: Optional[dict], artist_id: int, include_inactive: bool = False) -> dict:
    """ADMIN, o GESTOR dueno del artista (artists.user_id). Con include_inactive, un ADMIN
    tambien gestiona artistas archivados; para un GESTOR un archivado no existe."""
    if not user or user["role"] not in ("ADMIN", "GESTOR"):
        raise AppError(403, "FORBIDDEN", "Acceso denegado")
    artist = svc.get_artist_by_id(db, artist_id, include_inactive=include_inactive and user["role"] == "ADMIN")
    if not artist:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    if user["role"] == "GESTOR" and artist.get("user_id") != user["id"]:
        raise AppError(403, "FORBIDDEN", "No puedes gestionar el perfil de otro artista")
    return artist


def _check_owner_user(db: Session, user_id: Optional[int]):
    if user_id is not None and not svc.is_gestor(db, user_id):
        raise AppError(400, "VALIDATION", "user_id debe ser un gestor existente")


def _check_video_url(tipo: str, url: str):
    if tipo == "video" and url.startswith("/"):
        raise AppError(400, "VALIDATION", "Un video debe ser un enlace que empiece por https://")


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


# ───────────────────────── dashboard y metricas (por id numerico) ─────────────────────────

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


@router.get("/{artist_id:int}/metrics")
def list_metrics(artist_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    return svc.get_metrics_by_artist(db, artist_id)


# ───────────────────────── perfil por slug (catch-all, debe ir al final) ─────────────────────────

@router.get("/{slug}")
def profile(slug: str, db: Session = Depends(get_db)):
    data = svc.get_artist_profile(db, slug)
    if not data:
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    return data


# ───────────────────────── alta, archivado y restauracion (solo ADMIN) ─────────────────────────

@router.post("", status_code=201)
def create_artist(payload: ArtistCreateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    if not payload.stage_name:
        raise AppError(400, "VALIDATION", "El nombre artístico es requerido")
    _check_owner_user(db, payload.user_id)
    data = payload.model_dump()
    slug = data.pop("slug")
    if slug is None:
        slug = svc.generate_artist_slug(db, data["stage_name"])
    elif svc.artist_slug_taken(db, slug):
        raise AppError(409, "SLUG_IN_USE", "Ya existe un artista con ese slug")
    data["name"] = data["name"] or data["stage_name"]
    artist = svc.create_artist(db, {**data, "slug": slug})
    return {"id": artist.id, "slug": artist.slug}


@router.delete("/{artist_id:int}")
def archive_artist(artist_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    if not svc.get_artist_by_id(db, artist_id, include_inactive=True):
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    if not svc.set_artist_active(db, artist_id, False):
        return {"message": "El artista ya estaba archivado", "active": False}
    return {"message": "Artista archivado: ya no aparece en la web pública", "active": False}


@router.post("/{artist_id:int}/restore")
def restore_artist(artist_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(user, ("ADMIN",), ADMIN_ONLY)
    if not svc.get_artist_by_id(db, artist_id, include_inactive=True):
        raise AppError(404, "NOT_FOUND", "Artista no encontrado")
    if not svc.set_artist_active(db, artist_id, True):
        return {"message": "El artista ya estaba activo", "active": True}
    return {"message": "Artista restaurado", "active": True}


# ───────────────────────── mutaciones ─────────────────────────

@router.put("/{artist_id:int}")
def update_artist(artist_id: int, payload: ArtistUpdateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    updates = payload.provided()
    if not updates:
        raise AppError(400, "VALIDATION", "Sin cambios para aplicar")
    if user["role"] != "ADMIN" and ADMIN_ONLY_FIELDS & updates.keys():
        raise AppError(403, "FORBIDDEN", "Solo un administrador puede cambiar slug, destacado, estado o dueño")
    if "slug" in updates and svc.artist_slug_taken(db, updates["slug"], exclude_id=artist_id):
        raise AppError(409, "SLUG_IN_USE", "Ya existe un artista con ese slug")
    if "user_id" in updates:
        _check_owner_user(db, updates["user_id"])
    svc.update_artist_fields(db, artist_id, updates)
    return {"message": "Artista actualizado"}


@router.post("/{artist_id:int}/tracks", status_code=201)
def create_track(artist_id: int, payload: TrackInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    if not payload.title:
        raise AppError(400, "VALIDATION", "El título es requerido")
    track = svc.create_track(db, artist_id, payload.model_dump(exclude_unset=True))
    return {"id": track.id, "slug": track.slug, "message": "Canción creada"}


@router.put("/{artist_id:int}/tracks/{track_id:int}")
def update_track(artist_id: int, track_id: int, payload: TrackInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    track = svc.get_track(db, artist_id, track_id)
    if track is None:
        raise AppError(404, "NOT_FOUND", "Canción no encontrada")
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise AppError(400, "VALIDATION", "Sin cambios para aplicar")
    svc.update_track(db, track, updates)
    return {"message": "Canción actualizada"}


@router.delete("/{artist_id:int}/tracks/{track_id:int}")
def delete_track(artist_id: int, track_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    if svc.delete_track(db, artist_id, track_id) == 0:
        raise AppError(404, "NOT_FOUND", "Canción no encontrada")
    return {"message": "Canción eliminada"}


@router.post("/{artist_id:int}/timeline", status_code=201)
def create_timeline_entry(artist_id: int, payload: TimelineInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
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
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    rows = svc.update_timeline_entry(db, artist_id, entry_id, updates)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Hito no encontrado o sin cambios")
    return {"message": "Hito actualizado"}


@router.delete("/{artist_id:int}/timeline/{entry_id:int}")
def delete_timeline_entry(artist_id: int, entry_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    rows = svc.delete_timeline_entry(db, artist_id, entry_id)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Hito no encontrado")
    return {"message": "Hito eliminado"}


@router.post("/{artist_id:int}/media", status_code=201)
def create_media_item(artist_id: int, payload: MediaInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    url = (payload.url or "").strip()
    if not url:
        raise AppError(400, "VALIDATION", "La URL es requerida")
    _check_video_url(payload.tipo, url)
    media_id = svc.create_media_item(db, artist_id, {
        "tipo": payload.tipo, "url": url, "titulo": payload.titulo, "descripcion": payload.descripcion,
        "fecha": payload.fecha, "orden": payload.orden, "destacado": payload.destacado,
    })
    return {"id": media_id, "message": "Media agregada"}


@router.put("/{artist_id:int}/media/{media_id:int}")
def update_media_item(artist_id: int, media_id: int, payload: MediaInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    item = svc.get_media_item(db, artist_id, media_id)
    if item is None:
        raise AppError(404, "NOT_FOUND", "Media no encontrada o sin cambios")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    _check_video_url(updates.get("tipo", item.tipo), updates.get("url", item.url))
    rows = svc.update_media_item(db, artist_id, media_id, updates)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Media no encontrada o sin cambios")
    return {"message": "Media actualizada"}


@router.delete("/{artist_id:int}/media/{media_id:int}")
def delete_media_item(artist_id: int, media_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    rows = svc.delete_media_item(db, artist_id, media_id)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Media no encontrada")
    return {"message": "Media eliminada"}


@router.post("/{artist_id:int}/social", status_code=201)
def create_social_link(artist_id: int, payload: SocialLinkInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    platform = (payload.platform or "").strip()
    url = (payload.url or "").strip()
    if not platform or not url:
        raise AppError(400, "VALIDATION", "Plataforma y URL son requeridas")
    link_id = svc.create_social_link(db, artist_id, {
        "platform": platform, "url": url, "username": payload.username,
        "icon": payload.icon, "orden": payload.orden,
    })
    return {"id": link_id, "message": "Red social agregada"}


@router.put("/{artist_id:int}/social/{link_id:int}")
def update_social_link(artist_id: int, link_id: int, payload: SocialLinkInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise AppError(400, "VALIDATION", "Sin cambios para aplicar")
    if svc.update_social_link(db, artist_id, link_id, updates) == 0:
        raise AppError(404, "NOT_FOUND", "Red social no encontrada")
    return {"message": "Red social actualizada"}


@router.delete("/{artist_id:int}/social/{link_id:int}")
def delete_social_link(artist_id: int, link_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    rows = svc.delete_social_link(db, artist_id, link_id)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Red social no encontrada")
    return {"message": "Red social eliminada"}


@router.post("/{artist_id:int}/connections", status_code=201)
def create_connection(artist_id: int, payload: ConnectionInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
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


@router.put("/{artist_id:int}/connections/{connection_id:int}")
def update_connection(artist_id: int, connection_id: int, payload: ConnectionInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise AppError(400, "VALIDATION", "Sin cambios para aplicar")
    if svc.update_connection(db, artist_id, connection_id, updates) == 0:
        raise AppError(404, "NOT_FOUND", "Conexion no encontrada")
    return {"message": "Conexion actualizada"}


@router.delete("/{artist_id:int}/connections/{connection_id:int}")
def delete_connection(artist_id: int, connection_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    rows = svc.delete_connection(db, artist_id, connection_id)
    if rows == 0:
        raise AppError(404, "NOT_FOUND", "Conexion no encontrada")
    return {"message": "Conexion eliminada"}


@router.post("/{artist_id:int}/metrics", status_code=201)
def create_metric(artist_id: int, payload: MetricInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    tipo = (payload.tipo or "").strip()
    if not tipo or payload.valor is None:
        raise AppError(400, "VALIDATION", "tipo y valor son requeridos")
    metric_id = svc.create_metric(db, artist_id, tipo, float(payload.valor), payload.fecha, payload.metadata)
    return {"id": metric_id, "message": "Metrica registrada"}


@router.put("/{artist_id:int}/metrics/{metric_id:int}")
def update_metric(artist_id: int, metric_id: int, payload: MetricUpdateInput, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise AppError(400, "VALIDATION", "Sin cambios para aplicar")
    if svc.update_metric(db, artist_id, metric_id, updates) == 0:
        raise AppError(404, "NOT_FOUND", "Metrica no encontrada")
    return {"message": "Metrica actualizada"}


@router.delete("/{artist_id:int}/metrics/{metric_id:int}")
def delete_metric(artist_id: int, metric_id: int, user: Optional[dict] = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_artist_admin(db, user, artist_id, include_inactive=True)
    if svc.delete_metric(db, artist_id, metric_id) == 0:
        raise AppError(404, "NOT_FOUND", "Metrica no encontrada")
    return {"message": "Metrica eliminada"}
