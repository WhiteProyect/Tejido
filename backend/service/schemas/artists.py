"""Modelos Pydantic para backend/service/api/routes/artists.py.

Fase 6: antes vivian inline en el router (unico modulo, junto con
collaborators.py, que todavia validaba a mano en vez de seguir el patron
declarativo que ya usa schemas/publications.py). Mismas reglas, sin cambio
de comportamiento.

Fase 6.1: los campos `fecha` pasan de str a date -- Pydantic valida formato
ISO 8601 (YYYY-MM-DD) nativamente, rechazando con 400 cualquier valor que no
lo sea. `MetricInput.fecha` pasa a requerido (antes tenia default "" pese a
que la columna en BD siempre fue NOT NULL).

CRUD de artistas: todas las URLs pasan por schemas/fields.py (imagenes y enlaces
internos admiten ruta del sitio; redes, plataformas y videos solo http(s)) y los
textos tienen longitud maxima. Los campos que en BD son NOT NULL no aceptan null
ni vacio cuando se envian (un PUT con "" no puede dejar la fila invalida).
"""
import re
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, field_validator

from backend.service.schemas.fields import external_url, optional_text, required_text, url_or_path

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
# Chocan con rutas literales de /api/artists (home) o con rutas del frontend.
RESERVED_SLUGS = {"home", "admin", "media-kit"}
MAX_SLUG_LENGTH = 80
DURATION_RE = re.compile(r"^(\d{1,3}:[0-5]\d|\d{1,2}:[0-5]\d:[0-5]\d)$")

MAX_NAME = 120
MAX_TITLE = 180
MAX_BIO = 5000
MAX_DESCRIPTION = 2000


def _slug_format(v, label):
    v = "" if v is None else str(v).strip().lower()
    if not v:
        raise ValueError(f"{label} es requerido")
    if len(v) > MAX_SLUG_LENGTH:
        raise ValueError(f"{label} no puede superar {MAX_SLUG_LENGTH} caracteres")
    if not SLUG_RE.match(v):
        raise ValueError(f"{label} solo admite minúsculas sin tildes, números y guiones (p. ej. dj-apolo)")
    return v


def artist_slug(v):
    v = _slug_format(v, "El slug")
    if v.isdigit():
        raise ValueError("El slug no puede ser solo números")
    if v in RESERVED_SLUGS:
        raise ValueError(f"El slug '{v}' está reservado")
    return v


def _not_null(v, label):
    if v is None:
        raise ValueError(f"{label} no puede ser null")
    return v


class _ArtistFields(BaseModel):
    """Campos editables comunes a crear y actualizar."""
    name: Optional[str] = None
    stage_name: Optional[str] = None
    real_name: Optional[str] = None
    bio: Optional[str] = None
    image: Optional[str] = None
    hero_image: Optional[str] = None
    genre: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    featured: Optional[bool] = None
    user_id: Optional[int] = None

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        return required_text(v, MAX_NAME, "El nombre")

    @field_validator("stage_name", mode="before")
    @classmethod
    def _stage_name(cls, v):
        return required_text(v, MAX_NAME, "El nombre artístico", min_length=2)

    @field_validator("real_name", "genre", "city", "region", mode="before")
    @classmethod
    def _short_text(cls, v):
        return optional_text(v, MAX_NAME, "El campo")

    @field_validator("bio", mode="before")
    @classmethod
    def _bio(cls, v):
        return optional_text(v, MAX_BIO, "La biografía")

    @field_validator("image", "hero_image", mode="before")
    @classmethod
    def _images(cls, v):
        return url_or_path(v)

    @field_validator("featured", mode="before")
    @classmethod
    def _featured(cls, v):
        return _not_null(v, "featured")


class ArtistCreateInput(_ArtistFields):
    """POST /api/artists (solo ADMIN). Sin slug, se genera desde stage_name (la ruta exige
    stage_name; aqui es opcional para responder el error en español)."""
    slug: Optional[str] = None
    city: Optional[str] = "Caucasia"
    region: Optional[str] = "Bajo Cauca, Antioquia"
    featured: bool = False

    @field_validator("slug", mode="before")
    @classmethod
    def _slug(cls, v):
        if v is None or not str(v).strip():
            return None
        return artist_slug(v)


class ArtistUpdateInput(_ArtistFields):
    """PUT /api/artists/{id}: solo se aplica lo enviado. slug, featured, active y user_id son
    exclusivos de ADMIN (la ruta lo comprueba)."""
    slug: Optional[str] = None
    active: Optional[bool] = None
    spotify_url: Optional[str] = None
    youtube_url: Optional[str] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None

    @field_validator("slug", mode="before")
    @classmethod
    def _slug(cls, v):
        return artist_slug(v)

    @field_validator("active", mode="before")
    @classmethod
    def _active(cls, v):
        return _not_null(v, "active")

    @field_validator("spotify_url", "youtube_url", "instagram_url", "tiktok_url", mode="before")
    @classmethod
    def _links(cls, v):
        return external_url(v)

    def provided(self) -> dict:
        return {k: v for k, v in self.model_dump(exclude_unset=True).items()}


class TrackInput(BaseModel):
    """POST/PUT de canciones. En el PUT solo se aplica lo enviado; el POST exige title."""
    title: Optional[str] = None
    slug: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    spotify_url: Optional[str] = None
    youtube_url: Optional[str] = None
    apple_music_url: Optional[str] = None
    amazon_music_url: Optional[str] = None
    release_date: Optional[date] = None
    status: Optional[Literal["published", "draft"]] = None
    featured: Optional[bool] = None

    @field_validator("title", mode="before")
    @classmethod
    def _title(cls, v):
        return required_text(v, MAX_TITLE, "El título")

    @field_validator("slug", mode="before")
    @classmethod
    def _slug(cls, v):
        if v is None or not str(v).strip():
            return None
        return _slug_format(v, "El slug de la canción")

    @field_validator("album", "genre", mode="before")
    @classmethod
    def _short_text(cls, v):
        return optional_text(v, MAX_NAME, "El campo")

    @field_validator("duration", mode="before")
    @classmethod
    def _duration(cls, v):
        v = optional_text(v, 10, "La duración")
        if v is not None and not DURATION_RE.match(v):
            raise ValueError("La duración debe tener formato mm:ss o h:mm:ss (p. ej. 3:40)")
        return v

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return optional_text(v, MAX_DESCRIPTION, "La descripción")

    @field_validator("cover_image", mode="before")
    @classmethod
    def _cover(cls, v):
        return url_or_path(v)

    @field_validator("spotify_url", "youtube_url", "apple_music_url", "amazon_music_url", mode="before")
    @classmethod
    def _links(cls, v):
        return external_url(v)

    @field_validator("status", "featured", mode="before")
    @classmethod
    def _not_null_fields(cls, v):
        return _not_null(v, "El campo")


class TimelineInput(BaseModel):
    titulo: str = ""
    descripcion: Optional[str] = None
    fecha: Optional[date] = None
    imagen_url: Optional[str] = None
    video_url: Optional[str] = None
    orden: int = 0

    @field_validator("titulo", mode="before")
    @classmethod
    def _titulo(cls, v):
        return required_text(v, MAX_TITLE, "El título")

    @field_validator("descripcion", mode="before")
    @classmethod
    def _descripcion(cls, v):
        return optional_text(v, MAX_DESCRIPTION, "La descripción")

    @field_validator("imagen_url", mode="before")
    @classmethod
    def _imagen(cls, v):
        return url_or_path(v)

    @field_validator("video_url", mode="before")
    @classmethod
    def _video(cls, v):
        return external_url(v)


class MediaInput(BaseModel):
    """`url`: imagen (https o ruta del sitio) o video (solo https; la ruta lo comprueba
    con el tipo efectivo, que en un PUT puede venir de la fila guardada)."""
    tipo: Literal["image", "video"] = "image"
    url: str = ""
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[date] = None
    orden: int = 0
    destacado: bool = False

    @field_validator("url", mode="before")
    @classmethod
    def _url(cls, v):
        v = url_or_path(v)
        if v is None:
            raise ValueError("La URL es requerida")
        return v

    @field_validator("titulo", mode="before")
    @classmethod
    def _titulo(cls, v):
        return optional_text(v, MAX_TITLE, "El título")

    @field_validator("descripcion", mode="before")
    @classmethod
    def _descripcion(cls, v):
        return optional_text(v, MAX_DESCRIPTION, "La descripción")


class SocialLinkInput(BaseModel):
    platform: str = ""
    url: str = ""
    username: Optional[str] = None
    icon: Optional[str] = None
    orden: int = 0

    @field_validator("platform", mode="before")
    @classmethod
    def _platform(cls, v):
        return required_text(v, 50, "La plataforma")

    @field_validator("url", mode="before")
    @classmethod
    def _url(cls, v):
        v = external_url(v)
        if v is None:
            raise ValueError("La URL es requerida")
        return v

    @field_validator("username", mode="before")
    @classmethod
    def _username(cls, v):
        return optional_text(v, MAX_NAME, "El usuario")

    @field_validator("icon", mode="before")
    @classmethod
    def _icon(cls, v):
        return optional_text(v, 50, "El icono")


class ConnectionInput(BaseModel):
    entity_type: str = ""
    entity_id: Optional[int] = None
    titulo: str = ""
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    url: Optional[str] = None
    orden: int = 0

    @field_validator("entity_type", mode="before")
    @classmethod
    def _entity_type(cls, v):
        return required_text(v, 30, "El tipo de conexión")

    @field_validator("titulo", mode="before")
    @classmethod
    def _titulo(cls, v):
        return required_text(v, MAX_TITLE, "El título")

    @field_validator("descripcion", mode="before")
    @classmethod
    def _descripcion(cls, v):
        return optional_text(v, MAX_DESCRIPTION, "La descripción")

    # `url` admite ruta del sitio: una conexion puede apuntar a una pagina de TEJIDO.
    @field_validator("imagen_url", "url", mode="before")
    @classmethod
    def _urls(cls, v):
        return url_or_path(v)


class MetricInput(BaseModel):
    tipo: str = ""
    valor: Optional[float] = None
    fecha: date
    metadata: Optional[str] = None

    @field_validator("tipo", mode="before")
    @classmethod
    def _tipo(cls, v):
        return required_text(v, 60, "El tipo")


class MetricUpdateInput(BaseModel):
    """PUT de una metrica: solo lo enviado."""
    tipo: Optional[str] = None
    valor: Optional[float] = None
    fecha: Optional[date] = None
    metadata: Optional[str] = None

    @field_validator("tipo", mode="before")
    @classmethod
    def _tipo(cls, v):
        return required_text(v, 60, "El tipo")

    @field_validator("valor", "fecha", mode="before")
    @classmethod
    def _not_null_fields(cls, v):
        return _not_null(v, "El campo")
