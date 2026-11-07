"""Reemplaza backend/services/validation.py::publication_input().

Mismas reglas exactas (rangos de longitud, kinds permitidos) para no cambiar
el comportamiento que ya espera el frontend.

Fase 6.1: start_date/end_date pasan de str a datetime -- Pydantic valida
formato ISO 8601 nativamente (fecha sola o fecha+hora), rechazando con 400
cualquier valor que no lo sea, en vez de guardarlo tal cual en la base de
datos como pasaba antes.
"""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator, model_validator

from backend.service.schemas.cultural_categories import CULTURAL_CATEGORIES

ALLOWED_KINDS = {"HISTORIA", "EVENTO", "OPORTUNIDAD", "TALENTO", "INICIATIVA", "LUGAR"}


class PublicationInput(BaseModel):
    kind: str = "HISTORIA"
    category_id: int
    title: str
    # Obligatorios salvo en LUGAR (ahi son opcionales): se comprueban en _check_texts.
    summary: str = ""
    content: str = ""
    # Vacio = "Caucasia", salvo en LUGAR: ahi es la direccion o referencia, obligatoria y de hasta 160
    # (services/publications.py::clean_place responde 422).
    location: str = ""
    image: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    link: Optional[str] = None
    featured: bool = False
    publish: bool = False
    cultural_category: Optional[str] = None
    # Obligatorio, pero se comprueba en el servicio (services/municipalities.py) para responder 422
    # con su propio codigo; aqui solo se normaliza.
    municipality: Optional[str] = None
    # Opcionales. Se validan en el servicio (services/publications.py::clean_tagline/clean_tags) para
    # responder 422 en español con un codigo por campo; aqui llegan tal cual.
    tagline: Any = None
    tags: Any = None
    # Solo EVENTO (en otros tipos se ignora); se valida en services/publications.py::clean_tradition_text.
    tradition_text: Any = None
    # Solo EVENTO y LUGAR (obligatorias; en otros tipos se descartan): services/publications.py::clean_point.
    latitude: Any = None
    longitude: Any = None
    # Solo OPORTUNIDAD (en otros tipos se ignoran); se validan en services/publications.py::clean_opportunity.
    opportunity_type_id: Any = None
    organizer: Any = None
    requirements: Any = None
    prize: Any = None
    audience: Any = None
    # Solo LUGAR (en otros tipos se ignoran); se validan en services/publications.py::clean_place.
    place_category_id: Any = None
    phone: Any = None
    whatsapp: Any = None
    opening_hours: Any = None
    website: Any = None

    @field_validator("municipality", mode="before")
    @classmethod
    def _normalize_municipality(cls, v):
        v = str(v or "").strip().lower()
        return v or None

    @field_validator("kind", mode="before")
    @classmethod
    def _normalize_kind(cls, v):
        v = str(v or "HISTORIA").strip().upper()
        if v not in ALLOWED_KINDS:
            raise ValueError("Selecciona un tipo de publicación válido")
        return v

    @field_validator("cultural_category", mode="before")
    @classmethod
    def _normalize_cultural_category(cls, v):
        v = str(v or "").strip().upper()
        if not v:
            return None
        if v not in CULTURAL_CATEGORIES:
            raise ValueError("Selecciona una categoría cultural válida")
        return v

    @field_validator("category_id", mode="before")
    @classmethod
    def _parse_category_id(cls, v):
        try:
            return int(v)
        except (TypeError, ValueError):
            raise ValueError("Selecciona una categoría válida")

    @field_validator("title")
    @classmethod
    def _check_title(cls, v):
        v = (v or "").strip()
        if not 5 <= len(v) <= 180:
            raise ValueError("El título debe tener entre 5 y 180 caracteres")
        return v

    @field_validator("summary", "content", "location", mode="before")
    @classmethod
    def _strip(cls, v):
        return str(v if v is not None else "").strip()

    @model_validator(mode="after")
    def _check_texts(self):
        place = self.kind == "LUGAR"
        if not (0 if place else 10) <= len(self.summary) <= 500:
            raise ValueError("El resumen puede tener hasta 500 caracteres" if place else "El resumen debe tener entre 10 y 500 caracteres")
        if not (0 if place else 20) <= len(self.content) <= 20000:
            raise ValueError("La descripción puede tener hasta 20000 caracteres" if place else "El contenido debe tener entre 20 y 20000 caracteres")
        if not place:
            self.location = self.location or "Caucasia"
            if len(self.location) > 180:
                raise ValueError("El lugar es demasiado largo")
        return self


class PublicationStatusInput(BaseModel):
    status: str
    note: str = ""

    @field_validator("note", mode="before")
    @classmethod
    def _normalize_note(cls, v):
        return str(v or "").strip()
