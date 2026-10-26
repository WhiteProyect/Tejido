"""Entradas del perfil publico del gestor (services/org_profiles.py).

Todos los textos con optional_text/required_text y las URLs con url_or_path (imagenes) o
external_url (enlaces). Vacio = quitar el valor (None).
"""
import re
from datetime import date
from typing import Optional

from pydantic import BaseModel, field_validator

from backend.service.schemas.fields import external_url, optional_text, required_text, url_or_path
from backend.service.schemas.users import MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH

SOCIAL_PLATFORMS = ("instagram", "facebook", "tiktok", "youtube", "spotify", "x", "linkedin", "otro")
MAX_SOCIAL_LINKS = 8
MAX_HIGHLIGHTS = 8
MAX_HIGHLIGHT_IMAGES = 4
MAX_GALLERY_IMAGES = 12

_WHATSAPP_RE = re.compile(r"^\+?\d{7,19}$")
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _https(v, label):
    v = external_url(v)
    if v is not None and not v.lower().startswith("https://"):
        raise ValueError(f"{label} debe empezar por https://")
    return v


class ProfileUpdateInput(BaseModel):
    """PATCH /api/me/profile: parcial. branch, is_leader, active, slug y profile_hidden no estan
    (los decide el admin); si llegan en el body se ignoran."""
    name: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    tagline: Optional[str] = None
    cover_url: Optional[str] = None
    founded_year: Optional[int] = None
    municipality: Optional[str] = None
    has_venue: Optional[bool] = None
    address: Optional[str] = None
    opening_hours: Optional[str] = None
    map_url: Optional[str] = None
    whatsapp: Optional[str] = None
    public_email: Optional[str] = None
    website: Optional[str] = None
    show_whatsapp: Optional[bool] = None
    show_public_email: Optional[bool] = None
    show_website: Optional[bool] = None
    seeking_text: Optional[str] = None
    achievements: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        return None if v is None else required_text(v, MAX_NAME_LENGTH, "El nombre de la organización")

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return optional_text(v, MAX_DESCRIPTION_LENGTH, "La biografía")

    @field_validator("photo_url", "cover_url", mode="before")
    @classmethod
    def _image(cls, v):
        return url_or_path(v)

    @field_validator("map_url", mode="before")
    @classmethod
    def _map_url(cls, v):
        return _https(v, "El enlace del mapa")

    @field_validator("website", mode="before")
    @classmethod
    def _website(cls, v):
        return _https(v, "El sitio web")

    @field_validator("founded_year", mode="before")
    @classmethod
    def _founded_year(cls, v):
        if v in (None, ""):
            return None
        try:
            year = int(v)
        except (TypeError, ValueError):
            raise ValueError("El año de fundación debe ser un número")
        if not 1900 <= year <= date.today().year:
            raise ValueError(f"El año de fundación debe estar entre 1900 y {date.today().year}")
        return year

    @field_validator("whatsapp", mode="before")
    @classmethod
    def _whatsapp(cls, v):
        if v is None:
            return None
        v = re.sub(r"[\s\-().]", "", str(v))
        if not v:
            return None
        if len(v) > 20 or not _WHATSAPP_RE.match(v):
            raise ValueError("El WhatsApp debe tener solo números (y un + al inicio si quieres)")
        return v

    @field_validator("public_email", mode="before")
    @classmethod
    def _public_email(cls, v):
        v = optional_text(v, 120, "El correo público")
        if v is not None and not _EMAIL_RE.match(v):
            raise ValueError("Escribe un correo público válido")
        return v.lower() if v else v

    @field_validator("tagline", mode="before")
    @classmethod
    def _tagline(cls, v):
        return optional_text(v, 140, "El lema")

    @field_validator("municipality", mode="before")
    @classmethod
    def _municipality(cls, v):
        return optional_text(v, 60, "El municipio")

    @field_validator("address", mode="before")
    @classmethod
    def _address(cls, v):
        return optional_text(v, 200, "La dirección")

    @field_validator("opening_hours", mode="before")
    @classmethod
    def _opening_hours(cls, v):
        return optional_text(v, 300, "El horario")

    @field_validator("seeking_text", mode="before")
    @classmethod
    def _seeking(cls, v):
        return optional_text(v, 300, "Lo que buscas")

    @field_validator("achievements", mode="before")
    @classmethod
    def _achievements(cls, v):
        return optional_text(v, 800, "Los reconocimientos")


class SocialLinkInput(BaseModel):
    platform: str
    url: str
    label: Optional[str] = None

    @field_validator("platform", mode="before")
    @classmethod
    def _platform(cls, v):
        v = str(v or "").strip().lower()
        if v not in SOCIAL_PLATFORMS:
            raise ValueError(f"Red no válida: usa {', '.join(SOCIAL_PLATFORMS)}")
        return v

    @field_validator("url", mode="before")
    @classmethod
    def _url(cls, v):
        v = _https(v, "El enlace de la red")
        if v is None:
            raise ValueError("El enlace de la red es requerido")
        return v

    @field_validator("label", mode="before")
    @classmethod
    def _label(cls, v):
        return optional_text(v, 40, "El nombre de la red")


class SocialLinksInput(BaseModel):
    links: list[SocialLinkInput]

    @field_validator("links")
    @classmethod
    def _max(cls, v):
        if len(v) > MAX_SOCIAL_LINKS:
            raise ValueError(f"Máximo {MAX_SOCIAL_LINKS} redes")
        return v


class ImageInput(BaseModel):
    url: str
    alt_text: Optional[str] = None
    caption: Optional[str] = None

    @field_validator("url", mode="before")
    @classmethod
    def _url(cls, v):
        v = url_or_path(v)
        if v is None:
            raise ValueError("La imagen necesita una URL")
        return v

    @field_validator("alt_text", mode="before")
    @classmethod
    def _alt(cls, v):
        return optional_text(v, 150, "La descripción de la imagen")

    @field_validator("caption", mode="before")
    @classmethod
    def _caption(cls, v):
        return optional_text(v, 150, "El pie de foto")


def _max_images(v, limit, label):
    if v is not None and len(v) > limit:
        raise ValueError(f"Máximo {limit} imágenes {label}")
    return v


class HighlightInput(BaseModel):
    """POST (title obligatorio) y PATCH (todo opcional; images reemplaza la lista si llega)."""
    title: Optional[str] = None
    description: Optional[str] = None
    when_text: Optional[str] = None
    position: Optional[int] = None
    images: Optional[list[ImageInput]] = None

    @field_validator("title", mode="before")
    @classmethod
    def _title(cls, v):
        return None if v is None else required_text(v, 100, "El título")

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return optional_text(v, 1200, "La descripción")

    @field_validator("when_text", mode="before")
    @classmethod
    def _when(cls, v):
        return optional_text(v, 60, "El cuándo")

    @field_validator("images")
    @classmethod
    def _images(cls, v):
        return _max_images(v, MAX_HIGHLIGHT_IMAGES, "por manifestación")


class GalleryInput(BaseModel):
    images: list[ImageInput]

    @field_validator("images")
    @classmethod
    def _images(cls, v):
        return _max_images(v, MAX_GALLERY_IMAGES, "en la galería")
