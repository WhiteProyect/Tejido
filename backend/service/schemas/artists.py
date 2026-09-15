"""Modelos Pydantic para backend/service/api/routes/artists.py.

Fase 6: antes vivian inline en el router (unico modulo, junto con
collaborators.py, que todavia validaba a mano en vez de seguir el patron
declarativo que ya usa schemas/publications.py). Mismas reglas, sin cambio
de comportamiento.

Fase 6.1: los campos `fecha` pasan de str a date -- Pydantic valida formato
ISO 8601 (YYYY-MM-DD) nativamente, rechazando con 400 cualquier valor que no
lo sea. `MetricInput.fecha` pasa a requerido (antes tenia default "" pese a
que la columna en BD siempre fue NOT NULL).
"""
from datetime import date
from typing import Optional

from pydantic import BaseModel


class ArtistUpdateInput(BaseModel):
    name: Optional[str] = None
    stage_name: Optional[str] = None
    slug: Optional[str] = None
    real_name: Optional[str] = None
    bio: Optional[str] = None
    image: Optional[str] = None
    hero_image: Optional[str] = None
    genre: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    spotify_url: Optional[str] = None
    youtube_url: Optional[str] = None
    instagram_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    featured: Optional[bool] = None

    def provided(self) -> dict:
        return {k: v for k, v in self.model_dump(exclude_unset=True).items()}


class TimelineInput(BaseModel):
    titulo: str = ""
    descripcion: Optional[str] = None
    fecha: Optional[date] = None
    imagen_url: Optional[str] = None
    video_url: Optional[str] = None
    orden: int = 0


class MediaInput(BaseModel):
    tipo: str = "image"
    url: str = ""
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[date] = None
    orden: int = 0
    destacado: bool = False


class SocialLinkInput(BaseModel):
    platform: str = ""
    url: str = ""
    username: Optional[str] = None
    icon: Optional[str] = None
    orden: int = 0


class ConnectionInput(BaseModel):
    entity_type: str = ""
    entity_id: Optional[int] = None
    titulo: str = ""
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    url: Optional[str] = None
    orden: int = 0


class MetricInput(BaseModel):
    tipo: str = ""
    valor: Optional[float] = None
    fecha: date
    metadata: Optional[str] = None
